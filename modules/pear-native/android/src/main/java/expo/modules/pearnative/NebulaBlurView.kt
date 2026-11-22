package expo.modules.pearnative

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import android.view.ViewTreeObserver
import androidx.annotation.RequiresApi
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

// Le verre de la barre des onglets de Nébula, comme sur la planche « Nébula · onglets » :
// backdrop-filter: blur(60px) saturate(180%), voile rgba(28, 22, 40, .38), filet intérieur de 1 px blanc à 8 %.
//
// À chaque image, la zone de NebulaBlurTargetView qui se trouve sous la barre (plus une marge, pour que le
// bord du flou soit juste) est rejouée dans un RenderNode à qui on applique le flou puis la saturation
// (RenderEffect, sur le GPU). Rien n'est copié ni capturé : le flou suit le contenu en direct.
// Le filet est dessiné par-dessus le flou ; translucide, il s'éclaircit sur le clair et s'efface sur le sombre.
//
// La cible est retrouvée par son numéro React à chaque image tant qu'elle ne l'est pas : la barre peut être
// montée avant elle, ou la cible remplacée, sans jamais rester bloquée sans flou.
@SuppressLint("ViewConstructor")
class NebulaBlurView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = resources.displayMetrics.density
  private val blurNode: RenderNode? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) RenderNode("NebulaBlur") else null

  private var targetId: Int? = null
  private var target: NebulaBlurTargetView? = null

  // Écart type du flou, en points (le « 60px » de blur(60px)).
  private var blurDp = 60f
  private var saturation = 1.8f
  private var tint = Color.argb(97, 28, 22, 40)
  // Sans flou possible (Android 11 et moins, cible introuvable) : une couleur presque pleine.
  private var fallback = Color.argb(240, 20, 16, 28)
  private var edgeColor = Color.argb(20, 255, 255, 255)
  private var edgeDp = 1f
  private var cornerDp = 999f
  private var effectDirty = true

  private val targetLocation = IntArray(2)
  private val selfLocation = IntArray(2)
  private val edgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val edgeRect = RectF()

  // Avant chaque image (une page qui défile, une animation, la carte qu'on déplace…), le flou est rejoué.
  // Seul le RenderNode du flou est réenregistré : la vue elle-même n'est pas invalidée, donc pas de boucle
  // d'images quand rien ne bouge.
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // Le flou devient possible (cible trouvée) ou ne l'est plus : la vue se redessine une fois pour
      // passer de la couleur pleine au verre, ou l'inverse.
      if (recordBlur() != drawnBlurred) invalidate()
    }
    true
  }
  // Ce que la vue a dessiné la dernière fois : le flou, ou la couleur pleine de secours.
  private var drawnBlurred = false

  init {
    setWillNotDraw(false)
    // Coins arrondis nets (découpe par le contour, anticrénelée) : le flou ne déborde jamais de la pilule.
    outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) {
        outline.setRoundRect(0, 0, view.width, view.height, cornerPx())
      }
    }
    clipToOutline = true
  }

  private fun cornerPx(): Float = min(cornerDp * density, min(width, height) / 2f)

  fun setTargetId(id: Int?) {
    if (id == targetId) return
    targetId = id
    target = null
    invalidate()
  }

  fun setBlurRadius(dp: Float) {
    blurDp = max(0f, dp)
    effectDirty = true
    invalidate()
  }

  fun setSaturation(value: Float) {
    saturation = max(0f, value)
    effectDirty = true
    invalidate()
  }

  fun setTint(color: Int) {
    tint = color
    invalidate()
  }

  fun setFallbackColor(color: Int) {
    fallback = color
    invalidate()
  }

  fun setEdgeColor(color: Int) {
    edgeColor = color
    invalidate()
  }

  fun setEdgeWidth(dp: Float) {
    edgeDp = max(0f, dp)
    invalidate()
  }

  fun setCornerRadius(dp: Float) {
    cornerDp = max(0f, dp)
    invalidateOutline()
    invalidate()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    invalidateOutline()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(preDraw)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(preDraw)
    target = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) blurNode?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  // La cible, retrouvée tant qu'elle ne l'est pas. Jamais une cible qui contient la barre elle-même :
  // le flou se dessinerait dans sa propre source, à l'infini.
  private fun resolveTarget(): NebulaBlurTargetView? {
    target?.let { if (it.isAttachedToWindow) return it }
    val id = targetId ?: return null
    val found = try {
      appContext.findView<NebulaBlurTargetView>(id)
    } catch (e: Exception) {
      null
    }
    target = found?.takeIf { it.isAttachedToWindow && !isInside(it) }
    return target
  }

  private fun isInside(ancestor: View): Boolean {
    var parent = parent
    while (parent != null) {
      if (parent === ancestor) return true
      parent = parent.parent
    }
    return false
  }

  // Rejoue la partie de la cible qui est sous la barre (plus une marge de deux écarts types : au-delà, le
  // flou ne puise plus rien), dans le RenderNode flouté. Rend false si le flou n'est pas possible.
  @RequiresApi(Build.VERSION_CODES.S)
  private fun recordBlur(): Boolean {
    val node = blurNode ?: return false
    val source = resolveTarget()?.contentNode ?: return false
    if (width == 0 || height == 0 || !source.hasDisplayList()) return false
    if (effectDirty) {
      node.setRenderEffect(buildEffect())
      effectDirty = false
    }
    target?.getLocationInWindow(targetLocation)
    getLocationInWindow(selfLocation)
    val margin = ceil(blurDp * density * 2f).toInt()
    val dx = selfLocation[0] - targetLocation[0]
    val dy = selfLocation[1] - targetLocation[1]
    node.setPosition(0, 0, width + margin * 2, height + margin * 2)
    node.setTranslationX(-margin.toFloat())
    node.setTranslationY(-margin.toFloat())
    val canvas = node.beginRecording()
    try {
      // Le fond de l'app sous le contenu : une zone sans rien (vidéo, caméra) ne laisse pas voir de trou.
      canvas.drawColor(BASE)
      canvas.translate((margin - dx).toFloat(), (margin - dy).toFloat())
      canvas.drawRenderNode(source)
    } finally {
      node.endRecording()
    }
    return true
  }

  // Le flou, puis la saturation (dans cet ordre, comme backdrop-filter). Android parle en « rayon » :
  // Skia le convertit en écart type par σ = 0,57735 × rayon + 0,5 ; on part de σ pour retrouver le rayon.
  @RequiresApi(Build.VERSION_CODES.S)
  private fun buildEffect(): RenderEffect {
    val sigma = blurDp * density
    val radius = max(0.01f, (sigma - 0.5f) / 0.57735f)
    val blur = RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP)
    if (abs(saturation - 1f) < 0.001f) return blur
    val matrix = ColorMatrix().apply { setSaturation(saturation) }
    return RenderEffect.createColorFilterEffect(ColorMatrixColorFilter(matrix), blur)
  }

  override fun onDraw(canvas: Canvas) {
    val node = blurNode
    val blurred = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && node != null && canvas.isHardwareAccelerated && recordBlur()
    drawnBlurred = blurred
    if (blurred && node != null) {
      canvas.drawRenderNode(node)
      canvas.drawColor(tint)
    } else {
      canvas.drawColor(fallback)
    }
    if (edgeDp > 0f && Color.alpha(edgeColor) > 0) {
      val stroke = edgeDp * density
      edgePaint.strokeWidth = stroke
      edgePaint.color = edgeColor
      edgeRect.set(stroke / 2f, stroke / 2f, width - stroke / 2f, height - stroke / 2f)
      val radius = max(0f, cornerPx() - stroke / 2f)
      canvas.drawRoundRect(edgeRect, radius, radius, edgePaint)
    }
  }

  private companion object {
    // Le fond de Nébula (#0B0B0C).
    val BASE = Color.rgb(11, 11, 12)
  }
}

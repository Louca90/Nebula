package expo.modules.pearnative

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

// Tout ce qui passe sous la barre des onglets de Nébula (les pages de l'app). À chaque image, ses enfants
// sont enregistrés dans un RenderNode, puis ce RenderNode est dessiné normalement : NebulaBlurView rejoue
// ce même enregistrement, flouté, sans copie d'image ni capture d'écran. C'est ce qui rend le flou vivant
// (défilement, animations, carte). Android 12 et plus ; avant, la barre prend une couleur pleine.
// Les enfants sont placés par React Native : aucune mise en page Android ici.
@SuppressLint("ViewConstructor")
class NebulaBlurTargetView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  internal val contentNode: RenderNode? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) RenderNode("NebulaBlurTarget") else null

  override fun dispatchDraw(canvas: Canvas) {
    val node = contentNode
    if (node == null || !canvas.isHardwareAccelerated) {
      super.dispatchDraw(canvas)
      return
    }
    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording()
    try {
      super.dispatchDraw(recording)
    } finally {
      node.endRecording()
    }
    canvas.drawRenderNode(node)
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    // React Native place les pages lui-même (LinearLayout les rangerait l'une après l'autre).
  }
}

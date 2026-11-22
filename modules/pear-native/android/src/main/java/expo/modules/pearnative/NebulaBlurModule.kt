package expo.modules.pearnative

import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Le flou en direct de la barre des onglets de Nébula : NebulaBlurTarget enveloppe les pages,
// NebulaBlurView les rejoue floutées sous la barre (voir ces deux classes).
class NebulaBlurModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NebulaBlur")

    View(NebulaBlurView::class) {
      Name("NebulaBlurView")
      Prop("targetId") { view: NebulaBlurView, id: Int? -> view.setTargetId(id) }
      Prop("blurRadius") { view: NebulaBlurView, dp: Float -> view.setBlurRadius(dp) }
      Prop("saturation") { view: NebulaBlurView, value: Float -> view.setSaturation(value) }
      Prop("tint") { view: NebulaBlurView, color: Color? -> view.setTint(color?.toArgb() ?: Color.TRANSPARENT) }
      Prop("fallbackColor") { view: NebulaBlurView, color: Color? -> view.setFallbackColor(color?.toArgb() ?: Color.TRANSPARENT) }
      Prop("edgeColor") { view: NebulaBlurView, color: Color? -> view.setEdgeColor(color?.toArgb() ?: Color.TRANSPARENT) }
      Prop("edgeWidth") { view: NebulaBlurView, dp: Float -> view.setEdgeWidth(dp) }
      Prop("cornerRadius") { view: NebulaBlurView, dp: Float -> view.setCornerRadius(dp) }
    }

    View(NebulaBlurTargetView::class) {
      Name("NebulaBlurTarget")
    }
  }
}

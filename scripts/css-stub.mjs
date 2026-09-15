// Node ESM loader hook.
//
// Tool modules import their own stylesheets (`import "../../styles/tools/x.css"`).
// Vite and Vitest resolve those; plain Node cannot evaluate CSS. Anything that
// loads the registry outside those tools (e.g. the SEO generator) registers this
// hook first so every `.css` specifier resolves to an empty module.
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) {
    return { url: 'data:text/javascript,export default {}', shortCircuit: true }
  }
  return next(specifier, context)
}

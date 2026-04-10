// Declara imports de CSS como efeito colateral (globals.css, etc.)
declare module "*.css" {
  const content: Record<string, string>
  export default content
}

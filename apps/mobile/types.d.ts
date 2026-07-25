// CSS imports are resolved by Metro/react-native-web at bundle time; declare
// them so TypeScript doesn't choke on the template's web-only style imports.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

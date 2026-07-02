// Empty module shim used by Turbopack `resolveAlias` and Webpack `resolve.alias`
// to stub out React Native packages that some Web3 libraries optimistically
// import but that aren't available (or needed) in a browser build.
const emptyModule = {};
export default emptyModule;

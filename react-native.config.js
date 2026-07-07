module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import io.instally.reactnative.InstallyReactNativePackage;',
        packageInstance: 'new InstallyReactNativePackage()',
      },
    },
  },
};

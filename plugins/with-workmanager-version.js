const { withProjectBuildGradle } = require("@expo/config-plugins");

const MARKER = "// FITNESS_PRO_WORKMANAGER_VERSION_PIN";

module.exports = function withWorkManagerVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("Fitness Pro WorkManager pin expects the generated Groovy project build.gradle.");
    }

    let contents = config.modResults.contents;
    if (!contents.includes(MARKER)) {
      contents += `

${MARKER}
allprojects {
    configurations.configureEach {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == "androidx.work") {
                details.useVersion("2.12.0")
                details.because("Use the stable WorkManager release for Android startup reliability testing")
            }
        }
    }
}
`;
    }
    config.modResults.contents = contents;
    return config;
  });
};

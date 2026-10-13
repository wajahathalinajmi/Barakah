plugins {
    id("com.android.application")
}

android {
    namespace = "com.barakah.spiritualtracker"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.barakah.spiritualtracker"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("androidx.core:core:1.19.1")
}

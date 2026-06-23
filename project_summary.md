# LCM Ministerial College App Project Summary

A consolidated overview of the status, architecture, and features of the LCM Ministerial College App.

## 📋 General Information
- **Project Name:** LCM Ministerial College App (lcm_college)
- **Type:** Multi-Platform E-Learning System (Flutter Mobile App + Student Web Portal + Admin Panel)
- **Objective:** Provide direct access to courses, interactive quizzes, schedules, and digital certifications for Ministerial college students, with complete coordinator course management tools.
- **Start Date:** April 2026
- **Status:** Active Development (Build Stabilization Phase)
- **Expected Completion:** Q3/Q4 2026

---

## 🛠️ Technology Stack
### Frontend (Mobile App)
- **Framework:** Flutter (stable channel 3.32.8), Dart (3.8.1)
- **State Management:** Riverpod (Clean Architecture)
- **Key Packages:** `cached_network_image`, `video_player`, `pdf`, `printing`, `shared_preferences`, `google_sign_in`, `material_symbols_icons`

### Web Portals
- **Technology:** Static HTML5, Vanilla CSS3 (custom glassmorphism design), JavaScript
- **Modules:** Student Portal (`course_web_app`) and Administrator Control Panel (`@admin`)

### Backend & Database
- **Platform:** Firebase (Auth, Firestore, Storage, Messaging, Cloud Functions)
- **Authentication:** Email/Password & Google Sign-In
- **Database:** Cloud Firestore & local SQL backups

---

## ✨ Key Features
- **Sermon & Lecture Player:** Video streaming with playback speed control, syllabus downloading, and course progress tracking.
- **Interactive Quizzes & Assessments:** timed multiple-choice assessments with scoring logs.
- **Digital Certificates:** Automated PDF generation, sharing, and printing upon completing courses.
- **Admin Management Panel:** Course builder (add/edit courses/lessons), category administration, review approvals, and student database management.
- **FCM Push Notifications:** Real-time updates alerting students of chapel services, prayer meetings, and assignment deadlines.

---

## 📊 Performance & Usage Metrics
- **Course Completion Rate:** Calculates completed plays/courses relative to enrollment (`completions / enrollment`).
- **Quiz Performance Score:** Aggregates average student grades and distribution patterns across tests.
- **Streaming Buffering Latency:** Monitors lesson video loading speeds and optimization metrics.

---

## ⚠️ Current Issues & Risks
> [!WARNING]
> **Firebase Package Mismatch:** The Android build fails (`assembleDebug` task) due to a package mismatch. The application configuration expects `com.lcmcollege.lcm_college` but `google-services.json` has conflicts or expects `com.college.college_app`.
> 
> **Build warnings:** Deprecated Gradle features are used, requiring configuration updates before Gradle 9.0.

---

## 🚀 Next Steps
1. **Resolve Package Name Mismatch:** Sync package name configurations in `android/app/build.gradle.kts` with `google-services.json`.
2. **Audit Gradle Dependencies:** Align Android build settings with Android SDK 36.0.0 and Java 21/Gradle 8.12.
3. **Deploy Web Portals:** Configure Firebase hosting deployment parameters for the `landing_page` and `course_web_app` portals.

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onProgressUpdate = exports.onEnrollmentUpdate = exports.onUserCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
/**
 * HELPER: Send push notification to a specific user
 */
async function sendPushNotification(userId, title, body) {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    if (fcmToken) {
        const message = {
            notification: { title, body },
            token: fcmToken,
        };
        await admin.messaging().send(message);
        console.log(`Push notification sent to ${userId}`);
    }
}
/**
 * HELPER: Trigger Email via 'Trigger Email' extension (Firestore mail collection)
 */
async function sendEmail(email, subject, text, html) {
    await admin.firestore().collection("mail").add({
        to: email,
        message: {
            subject: subject,
            text: text,
            html: html || text,
        },
    });
    console.log(`Email queued for ${email}`);
}
/**
 * 1. SIGNUP & SIGNIN (Welcome / Activity)
 */
exports.onUserCreated = functions.firestore
    .document("users/{userId}")
    .onCreate(async (snap, context) => {
    const userData = snap.data();
    const { email, fullName } = userData;
    await sendEmail(email, "Welcome to LCM College!", `Hi ${fullName},\n\nWelcome to your learning journey! Explore our courses and start mastering new skills today.`, `<h1>Welcome to LCM College, ${fullName}!</h1><p>Welcome to your learning journey! Explore our courses and start mastering new skills today.</p>`);
    await sendPushNotification(context.params.userId, "Welcome aboard!", "Start exploring our top courses today.");
});
/**
 * 2. ENROLLMENT
 */
exports.onEnrollmentUpdate = functions.firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data().enrolledCourses || [];
    const after = change.after.data().enrolledCourses || [];
    if (after.length > before.length) {
        const newCourseId = after[after.length - 1]; // Assuming new course added to end
        const userData = change.after.data();
        const courseDoc = await admin.firestore().collection("courses").doc(newCourseId).get();
        const courseTitle = courseDoc.data()?.title || "a new course";
        await sendEmail(userData.email, `Enrolled: ${courseTitle}`, `Hi ${userData.fullName},\n\nYou have successfully enrolled in ${courseTitle}. Happy learning!`, `<h1>Successfully Enrolled!</h1><p>You have successfully enrolled in <b>${courseTitle}</b>. Happy learning!</p>`);
        await sendPushNotification(context.params.userId, "Course Enrolled!", `You're now a student of ${courseTitle}.`);
    }
});
/**
 * 3. LESSON & COURSE COMPLETION
 */
exports.onProgressUpdate = functions.firestore
    .document("user_progress/{progressId}")
    .onWrite(async (change, context) => {
    const progressData = change.after.data();
    if (!progressData)
        return;
    const beforeStatus = change.before.data()?.isCompleted || false;
    const afterStatus = progressData.isCompleted || false;
    // Lesson Completed
    if (!beforeStatus && afterStatus) {
        const { userId, courseId, lessonId } = progressData;
        const lessonDoc = await admin.firestore().collection("lessons").doc(lessonId).get();
        const lessonTitle = lessonDoc.data()?.title || "a lesson";
        await sendPushNotification(userId, "Lesson Accomplished!", `Well done! You've successfully finished '${lessonTitle}'.`);
        // Check Course Completion
        const courseDoc = await admin.firestore().collection("courses").doc(courseId).get();
        const totalLessons = courseDoc.data()?.totalLessons || 0;
        const userProgressSnap = await admin.firestore()
            .collection("user_progress")
            .where("userId", "==", userId)
            .where("courseId", "==", courseId)
            .where("isCompleted", "==", true)
            .get();
        if (userProgressSnap.size >= totalLessons && totalLessons > 0) {
            const userDoc = await admin.firestore().collection("users").doc(userId).get();
            const userData = userDoc.data();
            if (userData) {
                await sendEmail(userData.email, "Certificate Unlocked: Course Completed!", `Hi ${userData.fullName},\n\nCongratulations! You have completed the entire course '${courseDoc.data()?.title}'. You can now download your certificate.`, `<h1>Congratulations, ${userData.fullName}!</h1><p>You have completed the entire course <b>${courseDoc.data()?.title}</b>. You can now download your certificate from the app.</p>`);
                await sendPushNotification(userId, "Course Completed! 🎓", "Congratulations! Your certificate is ready for download.");
            }
        }
    }
});
//# sourceMappingURL=index.js.map
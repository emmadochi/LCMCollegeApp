# Step-by-Step Deployment Guide for Cloud Functions

Follow these steps to deploy the automated email and push notification system. I have already verified your environment and confirmed the code builds correctly.

### Verified Environment
*   **Node.js:** v22.18.0 (Verified)
*   **npm:** 10.9.3 (Verified)
*   **Firebase CLI:** v14.16.0 (Verified via npx)
*   **Build Status:** Success (Tested `npm run build`)

### Step 1: Login to Firebase
Open your terminal in the `c:\xampp\htdocs\CollegeApp` directory and run:
```bash
npx firebase login
```
*Follow the browser instructions to authenticate.*

### Step 2: Initialize Functions (Optional)
If this is your first time deploying to this project, run:
```bash
npx firebase use --add
```
*Select your project from the list.*

### Step 3: Deploy to Firebase
Run the following command to deploy only the functions:
```bash
cd functions
npx firebase deploy --only functions
```

### Step 4: Activate Emailing (Firebase Console)
The code uses a `mail` collection trigger. To make it send actual emails:
1.  Go to the [Firebase Extensions Hub](https://console.firebase.google.com/project/_/extensions).
2.  Search for **"Trigger Email"**.
3.  Click **Install**.
4.  During configuration:
    *   Set **Email documents collection** to `mail`.
    *   Configure your **SMTP server** (e.g., Gmail, SendGrid, or Mailtrap).

### Step 5: FCM Server Key (For Push)
Ensure your Firebase project has Cloud Messaging enabled:
1.  Go to **Project Settings** > **Cloud Messaging**.
2.  Verify that **Firebase Cloud Messaging API (V1)** is enabled.
3.  The app is configured to use the FCM tokens stored in `users/{userId}/fcmToken`.

---
Your app is now ready to send automated welcome messages, enrollment alerts, and completion celebrations!


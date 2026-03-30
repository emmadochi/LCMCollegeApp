import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const settingsForm = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveBtn');

    // Load current settings
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "global"));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            document.getElementById('collegeName').value = data.collegeName || '';
            document.getElementById('supportEmail').value = data.supportEmail || '';
            document.getElementById('contactPhone').value = data.contactPhone || '';
            document.getElementById('collegeAddress').value = data.collegeAddress || '';
        } else {
            // Default values
            document.getElementById('collegeName').value = 'LCM College';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }

    // Save settings
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ogText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-icons animate-spin text-sm">sync</span> Saving...';
        saveBtn.disabled = true;

        const payload = {
            collegeName: document.getElementById('collegeName').value,
            supportEmail: document.getElementById('supportEmail').value,
            contactPhone: document.getElementById('contactPhone').value,
            collegeAddress: document.getElementById('collegeAddress').value,
            updatedAt: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "settings", "global"), payload);
            alert("Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error saving settings: " + error.message);
        } finally {
            saveBtn.innerHTML = ogText;
            saveBtn.disabled = false;
        }
    });
});

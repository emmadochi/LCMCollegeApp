// Settings are stored in localStorage as they are UI-level admin preferences.
// No Firebase dependency.

document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const saveBtn      = document.getElementById('saveBtn');

    const SETTINGS_KEY = 'lcm_admin_settings';

    // Load current settings from localStorage
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            document.getElementById('collegeName').value     = data.collegeName    || '';
            document.getElementById('supportEmail').value    = data.supportEmail   || '';
            document.getElementById('contactPhone').value    = data.contactPhone   || '';
            document.getElementById('collegeAddress').value  = data.collegeAddress || '';
        } else {
            document.getElementById('collegeName').value = 'LCM Ministerial College';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }

    // Save settings to localStorage
    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const ogText   = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-icons animate-spin text-sm">sync</span> Saving...';
        saveBtn.disabled  = true;

        const payload = {
            collegeName:    document.getElementById('collegeName').value,
            supportEmail:   document.getElementById('supportEmail').value,
            contactPhone:   document.getElementById('contactPhone').value,
            collegeAddress: document.getElementById('collegeAddress').value,
            updatedAt:      new Date().toISOString()
        };

        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
            alert("Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error saving settings: " + error.message);
        } finally {
            saveBtn.innerHTML = ogText;
            saveBtn.disabled  = false;
        }
    });
});

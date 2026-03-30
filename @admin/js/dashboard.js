import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

async function loadDashboard() {
    try {
        // 1. Fetch Students count
        const usersSnapshot = await getDocs(collection(db, "users"));
        const totalStudents = usersSnapshot.size;

        // 2. Fetch Courses
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        const totalCourses = coursesSnapshot.size;

        // 3. Fetch Certificates count
        const certsSnapshot = await getDocs(collection(db, "certificates"));
        const totalCerts = certsSnapshot.size;

        // 4. Calculate avg completion from user progress
        let totalProgress = 0;
        let usersWithProgress = 0;
        usersSnapshot.forEach(doc => {
            const d = doc.data();
            const prog = d.overallProgress ?? d.progress ?? d.completionRate ?? null;
            if (prog !== null && !isNaN(Number(prog))) {
                totalProgress += Number(prog);
                usersWithProgress++;
            }
        });
        const avgCompletion = usersWithProgress > 0 ? Math.round(totalProgress / usersWithProgress) : 0;

        // Update stat cards by ID
        const elStudents = document.getElementById('statStudents');
        if (elStudents) elStudents.textContent = totalStudents.toLocaleString();

        const elCourses = document.getElementById('statCourses');
        if (elCourses) elCourses.textContent = totalCourses.toLocaleString();

        const elCerts = document.getElementById('statCerts');
        if (elCerts) elCerts.textContent = totalCerts.toLocaleString();

        const elCompletion = document.getElementById('statCompletion');
        if (elCompletion) elCompletion.textContent = avgCompletion + '%';

        // Update trend labels
        const trends = document.querySelectorAll('.stat-trend.syncing');
        trends.forEach(t => {
            t.innerHTML = '<span class="material-icons" style="font-size:14px;color:#16a34a;">check_circle</span> Up to date';
            t.classList.remove('syncing');
        });

        // Populate recent courses table
        populateRecentCourses(coursesSnapshot);

    } catch (error) {
        console.error("Dashboard load error:", error);
        // Show error in table
        const tbody = document.getElementById('dashRecentCourses');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#ef4444;">
                Failed to load data. Check Firebase config and Firestore rules.
            </td></tr>`;
        }
    }
}

function populateRecentCourses(coursesSnapshot) {
    const tbody = document.getElementById('dashRecentCourses');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (coursesSnapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-muted);">No courses found.</td></tr>`;
        return;
    }

    const colors = ['indigo', 'teal', 'amber', 'emerald', 'blue'];
    let count = 0;

    coursesSnapshot.forEach((doc) => {
        if (count >= 5) return;
        const data = doc.data();
        const initials = data.title ? data.title.substring(0, 2).toUpperCase() : 'CO';
        const color = colors[count % colors.length];
        const modules = data.modules ? (Array.isArray(data.modules) ? data.modules.length : data.modules) : (data.totalModules || 0);
        const status = data.isPublished !== false ? 'Published' : 'Draft';
        const statusColor = status === 'Published' ? '#16a34a' : '#d97706';
        const statusBg = status === 'Published' ? '#f0fdf4' : '#fffbeb';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:12px 16px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--${color}-soft,#eef2ff);color:var(--${color},#4f46e5);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                        ${data.thumbnailUrl ? `<img src="${data.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;">` : initials}
                    </div>
                    <span style="font-size:14px;font-weight:500;color:var(--text-main);">${data.title || 'Untitled'}</span>
                </div>
            </td>
            <td style="padding:12px 16px;font-size:13px;color:var(--text-muted);">${modules}</td>
            <td style="padding:12px 16px;">
                <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${statusBg};color:${statusColor};">${status}</span>
            </td>
        `;
        tbody.appendChild(tr);
        count++;
    });
}

// Run on load
loadDashboard();

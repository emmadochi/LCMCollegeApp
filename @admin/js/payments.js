import { getAdminAuthHeader } from './auth.js';

let allTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadTransactions();

    const searchInput = document.getElementById('paymentsSearch');
    const gatewayFilter = document.getElementById('gatewayFilter');

    if (searchInput) {
        searchInput.addEventListener('input', () => filterAndRenderTransactions());
    }

    if (gatewayFilter) {
        gatewayFilter.addEventListener('change', () => filterAndRenderTransactions());
    }
});

async function loadTransactions() {
    const listEl = document.getElementById('paymentsList');
    if (!listEl) return;

    try {
        listEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center"><span class="loader align-middle mx-auto"></span><p class="mt-2 text-sm text-gray-500">Loading transactions...</p></td></tr>`;

        const response = await fetch('../api/admin/payments.php', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allTransactions = await response.json();
        calculateStats(allTransactions);
        renderTransactions(allTransactions);

    } catch (err) {
        console.error("Error loading transactions:", err);
        listEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Failed to load transactions. Check administrative permissions.</td></tr>`;
    }
}

function calculateStats(txs) {
    const totalRevenue = txs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0.00), 0.00);
    const count = txs.length;
    const avg = count > 0 ? (totalRevenue / count) : 0.00;

    const revEl = document.getElementById('statRevenue');
    const countEl = document.getElementById('statCount');
    const avgEl = document.getElementById('statAverage');

    if (revEl) revEl.textContent = `$${totalRevenue.toFixed(2)}`;
    if (countEl) countEl.textContent = count;
    if (avgEl) avgEl.textContent = `$${avg.toFixed(2)}`;
}

function filterAndRenderTransactions() {
    const searchVal = document.getElementById('paymentsSearch')?.value.trim().toLowerCase() || '';
    const gatewayVal = document.getElementById('gatewayFilter')?.value || '';

    let filtered = allTransactions;

    if (searchVal) {
        filtered = filtered.filter(tx => 
            tx.transaction_reference?.toLowerCase().includes(searchVal) ||
            tx.student_name?.toLowerCase().includes(searchVal) ||
            tx.student_email?.toLowerCase().includes(searchVal) ||
            tx.course_title?.toLowerCase().includes(searchVal)
        );
    }

    if (gatewayVal) {
        filtered = filtered.filter(tx => tx.payment_method?.toLowerCase() === gatewayVal.toLowerCase());
    }

    renderTransactions(filtered);
}

function renderTransactions(txs) {
    const listEl = document.getElementById('paymentsList');
    const countEl = document.getElementById('paymentResultCount');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (countEl) {
        countEl.textContent = `Showing ${txs.length} of ${allTransactions.length} results`;
    }

    if (txs.length === 0) {
        listEl.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-sm text-gray-500">No matching transactions found.</td></tr>`;
        return;
    }

    txs.forEach(tx => {
        const date = new Date(tx.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const gatewayName = getGatewayDisplayName(tx.payment_method);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        tr.innerHTML = `
            <td class="px-6 py-4 border-b border-gray-100">
                <div class="text-sm font-bold text-gray-900">${tx.student_name || 'Anonymous'}</div>
                <div class="text-xs text-gray-500 mt-0.5">${tx.student_email}</div>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <div class="text-sm text-gray-900 font-medium">${tx.course_title || 'Unknown Course'}</div>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <div class="text-sm text-gray-900 font-bold">$${parseFloat(tx.amount).toFixed(2)}</div>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <span class="text-xs font-semibold px-2.5 py-1 rounded bg-gray-100 text-gray-800">${gatewayName}</span>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <code class="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-bold">${tx.transaction_reference}</code>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <div class="text-xs text-gray-500">${date}</div>
            </td>
            <td class="px-6 py-4 border-b border-gray-100">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span> Success
                </span>
            </td>
        `;
        listEl.appendChild(tr);
    });
}

function getGatewayDisplayName(code) {
    if (!code) return 'Card';
    const names = {
        stripe: 'Stripe',
        paystack: 'Paystack',
        flutterwave: 'Flutterwave',
        sandbox: 'Sandbox Test',
        card: 'Card'
    };
    return names[code.toLowerCase()] || code;
}

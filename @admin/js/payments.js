import { getAdminAuthHeader } from './auth.js';

let allTransactions = [];

const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    CAD: 'C$'
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadTransactions();

    const searchInput = document.getElementById('paymentsSearch');
    const gatewayFilter = document.getElementById('gatewayFilter');
    const currencyFilter = document.getElementById('currencyFilter');

    if (searchInput) {
        searchInput.addEventListener('input', () => filterAndRenderTransactions());
    }

    if (gatewayFilter) {
        gatewayFilter.addEventListener('change', () => filterAndRenderTransactions());
    }

    if (currencyFilter) {
        currencyFilter.addEventListener('change', () => filterAndRenderTransactions());
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
    const count = txs.length;
    const countEl = document.getElementById('statCount');
    if (countEl) countEl.textContent = count;

    const revEl = document.getElementById('statRevenue');
    const avgEl = document.getElementById('statAverage');

    if (revEl) revEl.innerHTML = formatCurrencyStats(txs, 'revenue');
    if (avgEl) avgEl.innerHTML = formatCurrencyStats(txs, 'average');
}

function formatCurrencyStats(txs, calculateField) {
    const totals = {};
    txs.forEach(tx => {
        const cur = (tx.currency || 'USD').toUpperCase();
        const amt = parseFloat(tx.amount || 0);
        if (!totals[cur]) totals[cur] = { sum: 0, count: 0 };
        totals[cur].sum += amt;
        totals[cur].count++;
    });

    const keys = Object.keys(totals);
    if (keys.length === 0) return '<span class="text-gray-900 font-bold">$0.00</span>';
    
    return keys.map(cur => {
        const val = calculateField === 'revenue' 
            ? totals[cur].sum 
            : (totals[cur].sum / totals[cur].count);
        const symbol = currencySymbols[cur] || cur;
        return `<span class="whitespace-nowrap font-black text-gray-900">${symbol}${val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}<span class="text-xs text-gray-500 font-normal ml-0.5">${cur}</span></span>`;
    }).join('<span class="text-gray-300 mx-2 font-normal text-base">|</span>');
}

function filterAndRenderTransactions() {
    const searchVal = document.getElementById('paymentsSearch')?.value.trim().toLowerCase() || '';
    const gatewayVal = document.getElementById('gatewayFilter')?.value || '';
    const currencyVal = document.getElementById('currencyFilter')?.value || '';

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

    if (currencyVal) {
        filtered = filtered.filter(tx => (tx.currency || 'USD').toUpperCase() === currencyVal.toUpperCase());
    }

    calculateStats(filtered);
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
                <div class="text-sm text-gray-900 font-bold">
                    ${currencySymbols[tx.currency?.toUpperCase()] || tx.currency || '$'}${parseFloat(tx.amount).toFixed(2)}
                    <span class="text-xs text-gray-400 font-normal ml-0.5">${tx.currency?.toUpperCase() || 'USD'}</span>
                </div>
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

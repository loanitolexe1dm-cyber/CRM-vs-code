/**
 * accounts-management.js
 * Comprehensive Loan Case Disbursement & Accounts Management Module for Loanitol CRM
 * Implements:
 * 1. Case Disbursement Date
 * 2. Loan Amount (auto-linked to customer/case)
 * 3. Loan Product selector
 * 4. Bank Payout % and Auto-calculated Expected Payout (₹)
 * 5. DSA Details and DSA-wise Case & Payout History
 * 6. Bank/DSA Contacted Person details
 * 7. Bank / Financial Institution (searchable bank-wise)
 * 8. Referral Agent Details
 * 9. Referral Agent Payout % and Auto-calculated Referral Payout (₹)
 * 10. Advance from SME Register (Amount, Date, Purpose, Related Case/DSA, Adjustment, Balance)
 * 14. New DSA Communication Log & Registry
 * Workflow: Moving to 'disbursed' prompts the Questionnaire -> transferred to Accounts Window.
 */

(function () {
    'use strict';

    // Local Storage Keys
    const ACCOUNTS_STORAGE_KEY = 'crm_accounts_records';
    const DSA_STORAGE_KEY = 'crm_dsa_records';
    const SME_ADVANCE_STORAGE_KEY = 'crm_sme_advance_records';

    // Global in-memory data arrays
    window.accountsRecords = window.accountsRecords || [];
    window.dsaRecords = window.dsaRecords || [];
    window.smeAdvanceRecords = window.smeAdvanceRecords || [];
    window.currentAccountsTab = window.currentAccountsTab || 'cases';

    const LOAN_PRODUCTS = [
        'Business Loan',
        'Home Loan',
        'Personal Loan',
        'LAP',
        'Vehicle Loan',
        'MSME Loan',
        'Machinery Loan',
        'Project Finance',
        'Working Capital',
        'Professional Loan',
        'Doctor Loan',
        'Other Loan'
    ];

    const BANKS_LIST = [
        'HDFC Bank',
        'ICICI Bank',
        'State Bank of India',
        'Axis Bank',
        'Kotak Mahindra Bank',
        'Bajaj Finserv',
        'Tata Capital',
        'Cholamandalam',
        'Poonawalla Fincorp',
        'Piramal Finance',
        'L&T Finance',
        'Aditya Birla Finance',
        'Hero Fincorp',
        'Federal Bank',
        'IndusInd Bank',
        'Yes Bank',
        'IDFC First Bank',
        'Standard Chartered',
        'Bandhan Bank',
        'Other Bank / NBFC'
    ];

    // Initialize data from persistence or initialize standard starter records
    function initAccountsData() {
        try {
            const rawAcc = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
            if (rawAcc) {
                window.accountsRecords = JSON.parse(rawAcc);
            }
        } catch (e) {
            console.warn('Error reading accounts records from localStorage:', e);
        }

        try {
            const rawDsa = localStorage.getItem(DSA_STORAGE_KEY);
            if (rawDsa) {
                window.dsaRecords = JSON.parse(rawDsa);
            }
        } catch (e) {
            console.warn('Error reading DSA records from localStorage:', e);
        }

        try {
            const rawSme = localStorage.getItem(SME_ADVANCE_STORAGE_KEY);
            if (rawSme) {
                window.smeAdvanceRecords = JSON.parse(rawSme);
            }
        } catch (e) {
            console.warn('Error reading SME advance records from localStorage:', e);
        }

        // Seed initial sample DSAs if empty
        if (!window.dsaRecords || window.dsaRecords.length === 0) {
            window.dsaRecords = [
                {
                    id: 'dsa_1',
                    dsaName: 'FinGrow Partners',
                    dsaCode: 'DSA-FG-101',
                    contactPerson: 'Rajesh Sharma',
                    contactNumber: '9820112233',
                    email: 'rajesh@fingrow.co.in',
                    bank: 'HDFC Bank & ICICI Bank',
                    payoutTerms: '1.50% for MSME, 1.25% for LAP',
                    agreementDetails: 'Master Referral Agreement signed on 15-Jan-2026',
                    agreementDate: '2026-01-15',
                    status: 'active',
                    communicationHistory: [
                        {
                            id: 'comm_1',
                            date: '2026-01-15',
                            type: 'Meeting',
                            summary: 'Signed tie-up agreement for retail secured and MSME leads.',
                            by: 'Admin'
                        }
                    ]
                },
                {
                    id: 'dsa_2',
                    dsaName: 'Capital Connect Associates',
                    dsaCode: 'DSA-CCA-204',
                    contactPerson: 'Pooja Iyer',
                    contactNumber: '9845012345',
                    email: 'pooja@capitalconnect.in',
                    bank: 'Axis Bank & Tata Capital',
                    payoutTerms: '1.75% for Unsecured BL, 1.00% for HL',
                    agreementDetails: 'Empanelled via Corporate Sourcing Agreement',
                    agreementDate: '2026-02-10',
                    status: 'active',
                    communicationHistory: [
                        {
                            id: 'comm_2',
                            date: '2026-02-10',
                            type: 'Call',
                            summary: 'Empanelment approved; portal logins shared for case submissions.',
                            by: 'Admin'
                        }
                    ]
                }
            ];
            saveDsaRecords();
        }

        // Sync any leads that are already marked 'disbursed'
        syncDisbursedLeadsToAccounts();
    }

    function saveAccountsRecords() {
        try {
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(window.accountsRecords));
            if (typeof window.scheduleSaveLocalState === 'function') window.scheduleSaveLocalState();
        } catch (e) {
            console.warn('Error saving accounts records:', e);
        }
    }

    function saveDsaRecords() {
        try {
            localStorage.setItem(DSA_STORAGE_KEY, JSON.stringify(window.dsaRecords));
            if (typeof window.scheduleSaveLocalState === 'function') window.scheduleSaveLocalState();
        } catch (e) {
            console.warn('Error saving DSA records:', e);
        }
    }

    function saveSmeAdvanceRecords() {
        try {
            localStorage.setItem(SME_ADVANCE_STORAGE_KEY, JSON.stringify(window.smeAdvanceRecords));
            if (typeof window.scheduleSaveLocalState === 'function') window.scheduleSaveLocalState();
        } catch (e) {
            console.warn('Error saving SME advance records:', e);
        }
    }

    // Auto-sync leads in memory with status === 'disbursed' into accounts records
    function syncDisbursedLeadsToAccounts() {
        if (!Array.isArray(window.leads)) return;
        let modified = false;

        window.leads.forEach(l => {
            if (l.status === 'disbursed') {
                const existing = window.accountsRecords.find(a => a.leadId === l.id);
                if (!existing) {
                    const accData = l.accountsData || {};
                    const loanAmt = Number(accData.loanAmount || l.amount || l.loanAmount || 1500000);
                    const payoutPct = Number(accData.payoutPercentage || 1.5);
                    const expectedPayout = Number(accData.expectedPayoutAmount || Math.round((loanAmt * payoutPct) / 100));
                    const refPct = Number(accData.referralPayoutPercentage || 0.4);
                    const refAmt = Number(accData.referralPayoutAmount || Math.round((loanAmt * refPct) / 100));

                    const newRec = {
                        id: 'acc_' + l.id,
                        leadId: l.id,
                        customerName: l.name || l.customerName || 'Disbursed Client',
                        phone: l.phone || '',
                        email: l.email || '',
                        category: l.category || 'MSME',
                        disbursementDate: accData.disbursementDate || l.disbursementDate || new Date().toISOString().split('T')[0],
                        expectedPayoutDate: accData.expectedPayoutDate || calculateExpectedPayoutDate(accData.disbursementDate || new Date().toISOString().split('T')[0]),
                        loanAmount: loanAmt,
                        loanProduct: accData.loanProduct || l.loanType || l.product || 'Business Loan',
                        bankName: accData.bankName || l.bank || 'HDFC Bank',
                        payoutPercentage: payoutPct,
                        expectedPayoutAmount: expectedPayout,
                        dsaName: accData.dsaName || 'FinGrow Partners',
                        dsaCode: accData.dsaCode || 'DSA-FG-101',
                        contactedPerson: accData.contactedPerson || {
                            name: 'Senior Disbursal Manager',
                            phone: '9820098200',
                            email: 'disbursals@bank.com',
                            designation: 'Manager - Disbursals'
                        },
                        referralAgent: accData.referralAgent || {
                            name: l.sourceName || 'Direct / Partner',
                            phone: '9876543210',
                            email: ''
                        },
                        referralPayoutPercentage: refPct,
                        referralPayoutAmount: refAmt,
                        netCompanyMargin: expectedPayout - refAmt,
                        advanceFromSme: accData.advanceFromSme || {
                            hasAdvance: false,
                            advanceAmount: 0,
                            dateReceived: '',
                            purpose: '',
                            relatedCaseDsa: '',
                            adjustmentDetails: '',
                            adjustedAmount: 0,
                            balanceAmount: 0
                        },
                        payoutStatus: accData.payoutStatus || 'pending',
                        referralPaymentStatus: accData.referralPaymentStatus || 'unpaid',
                        remarks: accData.remarks || 'Case disbursed and ported to Accounts.',
                        createdAt: l.createdAt || new Date().toISOString()
                    };

                    window.accountsRecords.unshift(newRec);
                    l.accountsData = newRec;
                    modified = true;
                }
            }
        });

        if (modified) {
            saveAccountsRecords();
        }
    }

    // Standard expected payout cycle calculation (15th or 30th of the following month)
    function calculateExpectedPayoutDate(disbDateStr) {
        if (!disbDateStr) return '';
        const d = new Date(disbDateStr);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = d.getMonth();
        // Disbursed in month M -> payout expected by 15th of month M+1
        const nextMonthDate = new Date(year, month + 1, 15);
        const yyyy = nextMonthDate.getFullYear();
        const mm = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextMonthDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function formatCurrency(num) {
        const val = Number(num) || 0;
        return '₹ ' + val.toLocaleString('en-IN');
    }

    // =========================================================================
    // 1. DISBURSEMENT & ACCOUNTS QUESTIONNAIRE MODAL
    // =========================================================================
    window.openDisbursementQuestionnaire = function (leadId) {
        initAccountsData();

        let l = null;
        if (Array.isArray(window.leads)) {
            l = window.leads.find(x => x.id === leadId);
        }
        if (!l && typeof window.tableMemoryCache !== 'undefined' && window.tableMemoryCache.leads) {
            l = window.tableMemoryCache.leads[leadId];
        }

        const customerName = l ? (l.name || l.customerName || 'Valued Customer') : 'New Case';
        const rawAmount = l ? (l.amount || l.loanAmount || 1000000) : 1000000;
        const loanAmount = Number(rawAmount) || 1000000;
        const currentLoanProduct = l ? (l.loanType || l.product || 'Business Loan') : 'Business Loan';
        const currentBank = l ? (l.bank || l.selectedBank || 'HDFC Bank') : 'HDFC Bank';
        const todayStr = new Date().toISOString().split('T')[0];
        const existingAcc = l && l.accountsData ? l.accountsData : {};

        const initialDisbDate = existingAcc.disbursementDate || l?.disbursementDate || todayStr;
        const initialPayoutPct = existingAcc.payoutPercentage !== undefined ? existingAcc.payoutPercentage : 1.5;
        const initialExpectedPayout = Math.round((loanAmount * initialPayoutPct) / 100);
        const initialRefName = existingAcc.referralAgent?.name || (l?.source === 'referral' ? (l.sourceName || 'Referral Partner') : '');
        const initialRefPhone = existingAcc.referralAgent?.phone || '';
        const initialRefPayoutPct = existingAcc.referralPayoutPercentage !== undefined ? existingAcc.referralPayoutPercentage : 0.4;
        const initialRefPayoutAmt = Math.round((loanAmount * initialRefPayoutPct) / 100);
        const initialNetMargin = initialExpectedPayout - initialRefPayoutAmt;

        const adv = existingAcc.advanceFromSme || {};
        const hasAdvance = Boolean(adv.hasAdvance);
        const advAmount = Number(adv.advanceAmount) || 0;
        const advAdjusted = Number(adv.adjustedAmount) || 0;
        const advBalance = advAmount - advAdjusted;

        const dsaOptionsHtml = window.dsaRecords.map(d => `<option value="${d.dsaName}" data-code="${d.dsaCode}">${d.dsaName} (${d.dsaCode})</option>`).join('');

        const banksOptionsHtml = BANKS_LIST.map(b => `<option value="${b}">${b}</option>`).join('');

        const modalHtml = `
        <div style="padding: 4px 6px;">
            <!-- Header Summary Banner -->
            <div style="background: linear-gradient(135deg, rgba(217, 161, 62, 0.15), rgba(16, 185, 129, 0.15)); border: 1px solid rgba(217, 161, 62, 0.4); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fas fa-file-invoice-dollar mr-1"></i> Loan Case Disbursement & Accounts Questionnaire
                    </div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--text); margin-top: 2px;">
                        ${window.escapeHtml ? window.escapeHtml(customerName) : customerName}
                    </div>
                    <div style="font-size: 12px; color: var(--text2); margin-top: 2px;">
                        Case ID: <span style="color:var(--text); font-weight:600;">${leadId || 'N/A'}</span> • Category: <span style="color:var(--gold); font-weight:600;">${l?.category || 'MSME'}</span>
                    </div>
                </div>
                <div style="text-align: right; background: rgba(0,0,0,0.25); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border2);">
                    <div style="font-size: 11px; color: var(--text3); text-transform: uppercase;">Expected Payout Cycle Date</div>
                    <div id="accLivePayoutCycleDate" style="font-size: 14px; font-weight: 800; color: #34d399;">
                        ${calculateExpectedPayoutDate(initialDisbDate) || '15th of next month'}
                    </div>
                </div>
            </div>

            <form id="disbAccountsForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 18px;">
                
                <!-- SECTION 1: DISBURSEMENT DETAILS -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 10px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-money-check-alt"></i> 1. Core Disbursement Specifics
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                        
                        <!-- 1. Case Disbursement Date -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="far fa-calendar-alt text-gold"></i> Case Disbursement Date *
                            </label>
                            <input type="date" id="accDisbDate" class="tb-search" style="width: 100%; height: 38px;" value="${initialDisbDate}" onchange="window.recalculateDisbursementQuestionnaire()" required>
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">Exact date when loan amount was disbursed</span>
                        </div>

                        <!-- 2. Loan Amount -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-rupee-sign text-gold"></i> Disbursed Loan Amount (₹) *
                            </label>
                            <input type="number" id="accLoanAmount" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" value="${loanAmount}" min="0" oninput="window.recalculateDisbursementQuestionnaire()" required>
                            <span id="accLiveLoanAmountFormatted" style="font-size: 10px; color: #34d399; font-weight: 600; margin-top: 2px;">${formatCurrency(loanAmount)}</span>
                        </div>

                        <!-- 3. Loan Product -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-cubes text-gold"></i> Loan Product / Type *
                            </label>
                            <select id="accLoanProduct" class="tb-search" style="width: 100%; height: 38px;" required>
                                ${LOAN_PRODUCTS.map(p => `<option value="${p}" ${p.toLowerCase() === currentLoanProduct.toLowerCase() ? 'selected' : ''}>${p}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: BANK & CONTACTED PERSON -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 10px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-university"></i> 2. Bank / Institution & Case Handling Person
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                        
                        <!-- 7. Bank / Financial Institution -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-landmark text-gold"></i> Bank / Financial Institution *
                            </label>
                            <input list="accBankDataList" type="text" id="accBankName" class="tb-search" style="width: 100%; height: 38px;" value="${existingAcc.bankName || currentBank}" placeholder="Select or type Bank/NBFC" required>
                            <datalist id="accBankDataList">
                                ${banksOptionsHtml}
                            </datalist>
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">Searchable and filterable bank-wise</span>
                        </div>

                        <!-- 6. Contacted Person Name -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-user-tie text-gold"></i> Contacted Person Name (Bank/DSA) *
                            </label>
                            <input type="text" id="accContactPersonName" class="tb-search" style="width: 100%; height: 38px;" value="${existingAcc.contactedPerson?.name || ''}" placeholder="e.g. Ramesh Kumar" required>
                        </div>

                        <!-- 6. Contacted Person Phone -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-phone text-gold"></i> Contacted Person Mobile No.
                            </label>
                            <input type="tel" id="accContactPersonPhone" class="tb-search" style="width: 100%; height: 38px;" value="${existingAcc.contactedPerson?.phone || ''}" maxlength="20" placeholder="e.g. +91 98XXXXXXXX (up to 15 digits)">
                        </div>

                        <!-- 6. Contacted Person Email & Designation -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-envelope text-gold"></i> Designation & Official Email
                            </label>
                            <input type="text" id="accContactPersonDetails" class="tb-search" style="width: 100%; height: 38px;" value="${existingAcc.contactedPerson?.email || existingAcc.contactedPerson?.designation || ''}" placeholder="e.g. Sales Manager / official@bank.com">
                        </div>
                    </div>
                </div>

                <!-- SECTION 3: DSA DETAILS & BANK PAYOUT CALCULATION -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 10px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-handshake"></i> 3. DSA Sourcing & Bank Payout Percentage
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                        
                        <!-- 5. DSA Details -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-id-badge text-gold"></i> DSA Name / Code
                            </label>
                            <input list="accDsaDataList" type="text" id="accDsaName" class="tb-search" style="width: 100%; height: 38px;" value="${existingAcc.dsaName || 'Direct In-House'}" placeholder="Select or type DSA Name">
                            <datalist id="accDsaDataList">
                                <option value="Direct In-House (DSA-DIR-001)">Direct In-House</option>
                                ${dsaOptionsHtml}
                            </datalist>
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">Maintains DSA-wise case & payout history</span>
                        </div>

                        <!-- 4. Payout Percentage -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-percentage text-gold"></i> Agreed Bank Payout % *
                            </label>
                            <input type="number" step="0.01" min="0" id="accPayoutPct" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" value="${initialPayoutPct}" oninput="window.recalculateDisbursementQuestionnaire()" required>
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">e.g. 1.25%, 1.5%, 2.0%</span>
                        </div>

                        <!-- 4. Auto-calculated Expected Payout (₹) -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-coins text-gold"></i> Expected Bank Payout (₹) [Auto-Calculated]
                            </label>
                            <div id="accLiveExpectedPayoutDisplay" style="height: 38px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; padding: 0 14px; color: #34d399; font-weight: 800; font-size: 15px;">
                                ${formatCurrency(initialExpectedPayout)}
                            </div>
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">Formula: (Loan Amount × Payout %) ÷ 100</span>
                        </div>
                    </div>
                </div>

                <!-- SECTION 4: REFERRAL AGENT & SPLIT -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 10px; padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-user-friends"></i> 4. Referral Agent Details & Payout
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
                        
                        <!-- 8. Referral Agent Name -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-user text-gold"></i> Referral Agent Name
                            </label>
                            <input type="text" id="accReferralName" class="tb-search" style="width: 100%; height: 38px;" value="${initialRefName}" placeholder="e.g. Anand Mehta / Partner">
                        </div>

                        <!-- 8. Referral Agent Contact -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-phone text-gold"></i> Referral Agent Contact
                            </label>
                            <input type="tel" id="accReferralPhone" class="tb-search" style="width: 100%; height: 38px;" value="${initialRefPhone}" maxlength="20" placeholder="Phone number / details (up to 15 digits)">
                        </div>

                        <!-- 9. Referral Agent Payout Percentage -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-percent text-gold"></i> Referral Payout %
                            </label>
                            <input type="number" step="0.01" min="0" id="accReferralPayoutPct" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" value="${initialRefPayoutPct}" oninput="window.recalculateDisbursementQuestionnaire()">
                            <span style="font-size: 10px; color: var(--text3); margin-top: 2px;">Agreed referral commission %</span>
                        </div>

                        <!-- 9. Referral Agent Payout Amount [Auto-Calculated] -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-hand-holding-usd text-gold"></i> Referral Payout (₹) [Auto]
                            </label>
                            <div id="accLiveReferralPayoutDisplay" style="height: 38px; border-radius: 8px; background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.4); display: flex; align-items: center; padding: 0 14px; color: #facc15; font-weight: 800; font-size: 14px;">
                                ${formatCurrency(initialRefPayoutAmt)}
                            </div>
                        </div>

                        <!-- Net Spread / Revenue -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-wallet text-gold"></i> Net Company Margin (₹)
                            </label>
                            <div id="accLiveNetMarginDisplay" style="height: 38px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); display: flex; align-items: center; padding: 0 14px; color: #60a5fa; font-weight: 800; font-size: 14px;">
                                ${formatCurrency(initialNetMargin)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 5: ADVANCE FROM SME (Requirement 10) -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 10px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 13px; font-weight: 700; color: var(--gold); display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-coins"></i> 5. Advance from SME – Details
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="font-size: 12px; color: var(--text2); font-weight: 600;">Advance received from SME?</label>
                            <input type="checkbox" id="accHasSmeAdvanceToggle" ${hasAdvance ? 'checked' : ''} onchange="window.toggleSmeAdvanceFields(this.checked)" style="width: 18px; height: 18px; accent-color: var(--gold); cursor: pointer;">
                        </div>
                    </div>

                    <div id="accSmeAdvanceFieldsContainer" style="display: ${hasAdvance ? 'grid' : 'none'}; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; border-top: 1px solid var(--border2); padding-top: 12px; margin-top: 6px;">
                        
                        <!-- Advance Amount -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Advance Amount Received (₹) *</label>
                            <input type="number" min="0" id="accSmeAdvanceAmt" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" value="${advAmount}" oninput="window.recalculateSmeAdvanceBalance()">
                        </div>

                        <!-- Date Received -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Date Advance Received *</label>
                            <input type="date" id="accSmeAdvanceDate" class="tb-search" style="width: 100%; height: 38px;" value="${adv.dateReceived || todayStr}">
                        </div>

                        <!-- Purpose -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Advance Purpose</label>
                            <input type="text" id="accSmeAdvancePurpose" class="tb-search" style="width: 100%; height: 38px;" value="${adv.purpose || 'Valuation, Scrutiny & Facilitation'}" placeholder="e.g. Valuation, Legal search, Retainer">
                        </div>

                        <!-- Related Case / DSA -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Related Case / DSA Reference</label>
                            <input type="text" id="accSmeAdvanceRelated" class="tb-search" style="width: 100%; height: 38px;" value="${adv.relatedCaseDsa || (customerName + ' / ' + (existingAcc.dsaName || 'Direct'))}" placeholder="Case / DSA reference">
                        </div>

                        <!-- Adjustment Details -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Adjustment Details</label>
                            <input type="text" id="accSmeAdvanceAdjustDetails" class="tb-search" style="width: 100%; height: 38px;" value="${adv.adjustmentDetails || 'Adjusted from final commission on disbursement'}" placeholder="e.g. Adjusted against payout / Refundable">
                        </div>

                        <!-- Adjusted Amount -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Adjusted Amount (₹)</label>
                            <input type="number" min="0" id="accSmeAdjustedAmt" class="tb-search" style="width: 100%; height: 38px;" value="${advAdjusted}" oninput="window.recalculateSmeAdvanceBalance()">
                        </div>

                        <!-- Balance Advance Amount [Auto-Calculated] -->
                        <div class="fg">
                            <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Balance Advance Amount (₹) [Auto]</label>
                            <div id="accLiveSmeBalanceDisplay" style="height: 38px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; padding: 0 14px; color: #34d399; font-weight: 800; font-size: 14px;">
                                ${formatCurrency(advBalance)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 6: REMARKS -->
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2); display: flex; align-items: center; gap: 4px;">
                        <i class="far fa-comment-dots text-gold"></i> Accounts & Disbursal Notes
                    </label>
                    <textarea id="accRemarks" class="tb-search" rows="2" style="width: 100%; resize: vertical;" placeholder="Additional financial notes, disbursement reference number, or transaction voucher details...">${existingAcc.remarks || ''}</textarea>
                </div>

            </form>
        </div>
        `;

        const modalFootHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.submitDisbursementQuestionnaire('${leadId || ''}')" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(217, 161, 62, 0.3);">
                <i class="fas fa-check-circle"></i> Save & Transfer to Accounts Window
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal(
                '<i class="fas fa-file-invoice-dollar text-gold mr-2"></i> Loan Case Disbursement & Accounts Questionnaire',
                modalHtml,
                modalFootHtml,
                'lg'
            );
        }
    };

    window.toggleSmeAdvanceFields = function (checked) {
        const container = document.getElementById('accSmeAdvanceFieldsContainer');
        if (container) {
            container.style.display = checked ? 'grid' : 'none';
        }
    };

    window.recalculateDisbursementQuestionnaire = function () {
        const amtInput = document.getElementById('accLoanAmount');
        const pctInput = document.getElementById('accPayoutPct');
        const refPctInput = document.getElementById('accReferralPayoutPct');
        const disbDateInput = document.getElementById('accDisbDate');

        const amount = Number(amtInput?.value) || 0;
        const payoutPct = Number(pctInput?.value) || 0;
        const refPayoutPct = Number(refPctInput?.value) || 0;

        const expectedPayout = Math.round((amount * payoutPct) / 100);
        const refPayoutAmt = Math.round((amount * refPayoutPct) / 100);
        const netMargin = expectedPayout - refPayoutAmt;

        const liveAmtEl = document.getElementById('accLiveLoanAmountFormatted');
        if (liveAmtEl) liveAmtEl.innerText = formatCurrency(amount);

        const livePayoutEl = document.getElementById('accLiveExpectedPayoutDisplay');
        if (livePayoutEl) livePayoutEl.innerText = formatCurrency(expectedPayout);

        const liveRefPayoutEl = document.getElementById('accLiveReferralPayoutDisplay');
        if (liveRefPayoutEl) liveRefPayoutEl.innerText = formatCurrency(refPayoutAmt);

        const liveNetMarginEl = document.getElementById('accLiveNetMarginDisplay');
        if (liveNetMarginEl) liveNetMarginEl.innerText = formatCurrency(netMargin);

        const disbDate = disbDateInput?.value;
        const cycleDateEl = document.getElementById('accLivePayoutCycleDate');
        if (cycleDateEl && disbDate) {
            cycleDateEl.innerText = calculateExpectedPayoutDate(disbDate);
        }

        window.recalculateSmeAdvanceBalance();
    };

    window.recalculateSmeAdvanceBalance = function () {
        const advAmtInput = document.getElementById('accSmeAdvanceAmt');
        const adjAmtInput = document.getElementById('accSmeAdjustedAmt');
        const advAmt = Number(advAmtInput?.value) || 0;
        const adjAmt = Number(adjAmtInput?.value) || 0;
        const bal = advAmt - adjAmt;

        const balDisplay = document.getElementById('accLiveSmeBalanceDisplay');
        if (balDisplay) {
            balDisplay.innerText = formatCurrency(bal);
        }
    };

    // Submitting questionnaire
    window.submitDisbursementQuestionnaire = function (leadId) {
        const disbDate = document.getElementById('accDisbDate')?.value;
        const loanAmt = Number(document.getElementById('accLoanAmount')?.value) || 0;
        const loanProduct = document.getElementById('accLoanProduct')?.value || 'Business Loan';
        const bankName = document.getElementById('accBankName')?.value?.trim() || '';
        const payoutPct = Number(document.getElementById('accPayoutPct')?.value) || 0;
        const dsaName = document.getElementById('accDsaName')?.value?.trim() || 'Direct In-House';
        const contactPersonName = document.getElementById('accContactPersonName')?.value?.trim() || '';
        const contactPersonPhone = document.getElementById('accContactPersonPhone')?.value?.trim() || '';
        const contactPersonDetails = document.getElementById('accContactPersonDetails')?.value?.trim() || '';
        const referralName = document.getElementById('accReferralName')?.value?.trim() || '';
        const referralPhone = document.getElementById('accReferralPhone')?.value?.trim() || '';
        const referralPayoutPct = Number(document.getElementById('accReferralPayoutPct')?.value) || 0;
        const remarks = document.getElementById('accRemarks')?.value?.trim() || '';

        const hasSmeAdvance = document.getElementById('accHasSmeAdvanceToggle')?.checked || false;
        const smeAdvAmt = Number(document.getElementById('accSmeAdvanceAmt')?.value) || 0;
        const smeAdvDate = document.getElementById('accSmeAdvanceDate')?.value || '';
        const smeAdvPurpose = document.getElementById('accSmeAdvancePurpose')?.value?.trim() || '';
        const smeAdvRelated = document.getElementById('accSmeAdvanceRelated')?.value?.trim() || '';
        const smeAdvAdjustDetails = document.getElementById('accSmeAdvanceAdjustDetails')?.value?.trim() || '';
        const smeAdjustedAmt = Number(document.getElementById('accSmeAdjustedAmt')?.value) || 0;
        const smeBalanceAmt = smeAdvAmt - smeAdjustedAmt;

        if (!disbDate) {
            if (typeof window.toast === 'function') window.toast('Please specify the Case Disbursement Date', 'warning');
            return;
        }
        if (loanAmt <= 0) {
            if (typeof window.toast === 'function') window.toast('Please enter a valid Disbursed Loan Amount', 'warning');
            return;
        }
        if (!bankName) {
            if (typeof window.toast === 'function') window.toast('Please specify the Bank / Financial Institution', 'warning');
            return;
        }

        const expectedPayoutAmt = Math.round((loanAmt * payoutPct) / 100);
        const refPayoutAmt = Math.round((loanAmt * referralPayoutPct) / 100);
        const netMargin = expectedPayoutAmt - refPayoutAmt;

        let targetLead = null;
        if (Array.isArray(window.leads)) {
            targetLead = window.leads.find(x => x.id === leadId);
        }
        if (!targetLead && typeof window.tableMemoryCache !== 'undefined' && window.tableMemoryCache.leads) {
            targetLead = window.tableMemoryCache.leads[leadId];
        }

        const customerName = targetLead ? (targetLead.name || targetLead.customerName || 'Customer') : 'Disbursed Client';

        const accountsPayload = {
            id: 'acc_' + (leadId || Date.now()),
            leadId: leadId || null,
            customerName: customerName,
            phone: targetLead?.phone || '',
            email: targetLead?.email || '',
            category: targetLead?.category || 'MSME',
            disbursementDate: disbDate,
            expectedPayoutDate: calculateExpectedPayoutDate(disbDate),
            loanAmount: loanAmt,
            loanProduct: loanProduct,
            bankName: bankName,
            payoutPercentage: payoutPct,
            expectedPayoutAmount: expectedPayoutAmt,
            dsaName: dsaName,
            dsaCode: dsaName.includes('(') ? (dsaName.split('(')[1].replace(')', '')) : 'DSA-' + dsaName.substring(0, 3).toUpperCase(),
            contactedPerson: {
                name: contactPersonName,
                phone: contactPersonPhone,
                email: contactPersonDetails,
                designation: contactPersonDetails
            },
            referralAgent: {
                name: referralName,
                phone: referralPhone
            },
            referralPayoutPercentage: referralPayoutPct,
            referralPayoutAmount: refPayoutAmt,
            netCompanyMargin: netMargin,
            advanceFromSme: {
                hasAdvance: hasSmeAdvance,
                advanceAmount: smeAdvAmt,
                dateReceived: smeAdvDate,
                purpose: smeAdvPurpose,
                relatedCaseDsa: smeAdvRelated,
                adjustmentDetails: smeAdvAdjustDetails,
                adjustedAmount: smeAdjustedAmt,
                balanceAmount: smeBalanceAmt
            },
            payoutStatus: 'pending',
            referralPaymentStatus: 'unpaid',
            remarks: remarks,
            updatedAt: new Date().toISOString()
        };

        // 1. Update Lead Status & Payload
        if (targetLead) {
            targetLead.status = 'disbursed';
            targetLead.disbursementDate = disbDate;
            targetLead.amount = loanAmt;
            targetLead.accountsData = accountsPayload;
            targetLead.history = targetLead.history || [];
            targetLead.history.push({
                action: 'Disbursed',
                status: 'disbursed',
                date: new Date().toISOString(),
                user: window.currentUser?.displayName || 'User',
                notes: `Loan Disbursed: ${formatCurrency(loanAmt)} via ${bankName}. Payout: ${payoutPct}% (${formatCurrency(expectedPayoutAmt)}). Transferred to Accounts.`
            });

            if (typeof window.saveLocalTableItem === 'function') {
                window.saveLocalTableItem('leads', targetLead.id, targetLead);
            }
            if (typeof window.saveLocalState === 'function') {
                window.saveLocalState(targetLead.id);
            }
        }

        // 2. Update Accounts Register
        const existingIdx = window.accountsRecords.findIndex(a => a.leadId === leadId || a.id === accountsPayload.id);
        if (existingIdx >= 0) {
            window.accountsRecords[existingIdx] = { ...window.accountsRecords[existingIdx], ...accountsPayload };
        } else {
            window.accountsRecords.unshift(accountsPayload);
        }
        saveAccountsRecords();

        // 3. Register SME Advance in global register if recorded
        if (hasSmeAdvance && smeAdvAmt > 0) {
            const smeAdvRecord = {
                id: 'sme_adv_' + Date.now(),
                caseId: leadId || null,
                customerName: customerName,
                advanceAmount: smeAdvAmt,
                dateReceived: smeAdvDate || disbDate,
                purpose: smeAdvPurpose || 'Valuation and documentation retainer',
                relatedCaseDsa: smeAdvRelated || (customerName + ' / ' + dsaName),
                adjustmentDetails: smeAdvAdjustDetails || 'Adjusted against payout commission',
                adjustedAmount: smeAdjustedAmt,
                balanceAmount: smeBalanceAmt,
                status: smeBalanceAmt <= 0 ? 'adjusted' : 'active',
                createdAt: new Date().toISOString()
            };
            window.smeAdvanceRecords.unshift(smeAdvRecord);
            saveSmeAdvanceRecords();
        }

        // 4. Ensure DSA exists in dsaRecords
        if (dsaName && dsaName !== 'Direct In-House') {
            const cleanDsa = dsaName.split('(')[0].trim();
            const existingDsa = window.dsaRecords.find(d => d.dsaName.toLowerCase() === cleanDsa.toLowerCase());
            if (!existingDsa) {
                window.dsaRecords.push({
                    id: 'dsa_' + Date.now(),
                    dsaName: cleanDsa,
                    dsaCode: accountsPayload.dsaCode,
                    contactPerson: contactPersonName,
                    contactNumber: contactPersonPhone,
                    email: contactPersonDetails,
                    bank: bankName,
                    payoutTerms: `${payoutPct}% for ${loanProduct}`,
                    agreementDetails: 'Auto-registered via case disbursement',
                    agreementDate: disbDate,
                    status: 'active',
                    communicationHistory: [
                        {
                            id: 'comm_' + Date.now(),
                            date: disbDate,
                            type: 'Disbursal',
                            summary: `Case ${customerName} disbursed for ${formatCurrency(loanAmt)}.`,
                            by: window.currentUser?.displayName || 'User'
                        }
                    ]
                });
                saveDsaRecords();
            }
        }

        if (typeof window.closeModal === 'function') {
            window.closeModal();
        }

        if (typeof window.toast === 'function') {
            window.toast(`Case successfully disbursed! Moving to Accounts window...`, 'success');
        }

        // Redirect directly to the Accounts window
        setTimeout(() => {
            if (typeof window.navToPage === 'function') {
                window.navToPage('accounts');
            }
        }, 150);
    };

    // =========================================================================
    // 2. ACCOUNTS WINDOW RENDERING ENGINE
    // =========================================================================
    window.renderAccountsPage = function () {
        initAccountsData();

        const container = document.getElementById('accountsTabContainer');
        if (!container) return;

        // Render KPI metric summary cards
        renderAccountsKpis();

        // Populate Bank filter dropdown options if not already done
        populateBankFilterOptions();

        // Get filter inputs
        const searchQuery = (document.getElementById('accSearchInput')?.value || '').toLowerCase().trim();
        const bankFilter = document.getElementById('accBankFilter')?.value || 'all';
        const productFilter = document.getElementById('accProductFilter')?.value || 'all';
        const statusFilter = document.getElementById('accPayoutStatusFilter')?.value || 'all';
        const dateFilter = document.getElementById('accDateFilter')?.value || 'all';

        // Filter accounts records
        let filteredCases = [...window.accountsRecords];

        if (searchQuery) {
            filteredCases = filteredCases.filter(c =>
                (c.customerName && c.customerName.toLowerCase().includes(searchQuery)) ||
                (c.bankName && c.bankName.toLowerCase().includes(searchQuery)) ||
                (c.dsaName && c.dsaName.toLowerCase().includes(searchQuery)) ||
                (c.loanProduct && c.loanProduct.toLowerCase().includes(searchQuery)) ||
                (c.phone && c.phone.includes(searchQuery)) ||
                (c.referralAgent?.name && c.referralAgent.name.toLowerCase().includes(searchQuery))
            );
        }

        if (bankFilter !== 'all') {
            filteredCases = filteredCases.filter(c => (c.bankName || '').toLowerCase().includes(bankFilter.toLowerCase()));
        }

        if (productFilter !== 'all') {
            filteredCases = filteredCases.filter(c => (c.loanProduct || '').toLowerCase() === productFilter.toLowerCase());
        }

        if (statusFilter !== 'all') {
            filteredCases = filteredCases.filter(c => (c.payoutStatus || 'pending') === statusFilter);
        }

        if (dateFilter !== 'all') {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            filteredCases = filteredCases.filter(c => {
                if (!c.disbursementDate) return false;
                const d = new Date(c.disbursementDate);
                if (dateFilter === 'this_month') {
                    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
                } else if (dateFilter === 'last_month') {
                    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                    return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
                } else if (dateFilter === 'this_quarter') {
                    const qCurrent = Math.floor(currentMonth / 3);
                    const qDisb = Math.floor(d.getMonth() / 3);
                    return d.getFullYear() === currentYear && qCurrent === qDisb;
                } else if (dateFilter === 'this_year') {
                    return d.getFullYear() === currentYear;
                }
                return true;
            });
        }

        // Update tab count badges
        const countCasesBadge = document.getElementById('accTabCount_cases');
        if (countCasesBadge) countCasesBadge.innerText = filteredCases.length;

        const countDsaBadge = document.getElementById('accTabCount_dsa');
        if (countDsaBadge) countDsaBadge.innerText = window.dsaRecords.length;

        const countSmeBadge = document.getElementById('accTabCount_sme');
        if (countSmeBadge) countSmeBadge.innerText = window.smeAdvanceRecords.length;

        const countCommBadge = document.getElementById('accTabCount_comm');
        if (countCommBadge) {
            const totalComms = window.dsaRecords.reduce((acc, d) => acc + (d.communicationHistory?.length || 0), 0);
            countCommBadge.innerText = totalComms;
        }

        const countReferralBadge = document.getElementById('accTabCount_referral');
        if (countReferralBadge) {
            const referralCases = window.accountsRecords.filter(c => c.referralAgent?.name);
            countReferralBadge.innerText = referralCases.length;
        }

        const totalCasesBadge = document.getElementById('acc-total-cases-badge');
        if (totalCasesBadge) totalCasesBadge.innerText = `${window.accountsRecords.length} Disbursed Cases`;

        // Render current active tab
        switch (window.currentAccountsTab) {
            case 'dsa':
                container.innerHTML = renderDsaHistoryTab(searchQuery);
                break;
            case 'sme':
                container.innerHTML = renderSmeAdvanceTab(searchQuery);
                break;
            case 'comm':
                container.innerHTML = renderDsaCommunicationTab(searchQuery);
                break;
            case 'referral':
                container.innerHTML = renderReferralLedgerTab(searchQuery);
                break;
            case 'cases':
            default:
                container.innerHTML = renderDisbursedCasesTab(filteredCases);
                break;
        }
    };

    function populateBankFilterOptions() {
        const select = document.getElementById('accBankFilter');
        if (!select || select.options.length > 1) return;

        // Unique banks from accounts records + standard list
        const banksSet = new Set(BANKS_LIST);
        window.accountsRecords.forEach(c => {
            if (c.bankName) banksSet.add(c.bankName);
        });

        Array.from(banksSet).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            select.appendChild(opt);
        });
    }

    function renderAccountsKpis() {
        const kpiGrid = document.getElementById('accounts-kpi-grid');
        if (!kpiGrid) return;

        let totalDisbursedVol = 0;
        let totalExpectedPayout = 0;
        let totalReferralPayable = 0;
        let totalReceivedPayout = 0;

        window.accountsRecords.forEach(c => {
            const amt = Number(c.loanAmount) || 0;
            const exp = Number(c.expectedPayoutAmount) || 0;
            const ref = Number(c.referralPayoutAmount) || 0;
            totalDisbursedVol += amt;
            totalExpectedPayout += exp;
            totalReferralPayable += ref;
            if (c.payoutStatus === 'received' || c.payoutStatus === 'reconciled') {
                totalReceivedPayout += exp;
            }
        });

        const netCompanyMargin = totalExpectedPayout - totalReferralPayable;

        let totalSmeAdvanceBal = 0;
        window.smeAdvanceRecords.forEach(a => {
            totalSmeAdvanceBal += Number(a.balanceAmount) || 0;
        });

        kpiGrid.innerHTML = `
            <div class="demo-stat-card" style="background: rgba(217, 161, 62, 0.08); border: 1px solid rgba(217, 161, 62, 0.3); border-radius: 12px; padding: 14px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: var(--gold); text-transform: uppercase;">Total Disbursed Volume</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--text); margin: 4px 0;">${formatCurrency(totalDisbursedVol)}</div>
                <div style="font-size: 11px; color: var(--text3);">${window.accountsRecords.length} Active Disbursed Cases</div>
            </div>

            <div class="demo-stat-card" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 14px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase;">Expected Bank Payout</div>
                <div style="font-size: 20px; font-weight: 800; color: #34d399; margin: 4px 0;">${formatCurrency(totalExpectedPayout)}</div>
                <div style="font-size: 11px; color: var(--text3);">Received: <span style="color:#10b981; font-weight:700;">${formatCurrency(totalReceivedPayout)}</span></div>
            </div>

            <div class="demo-stat-card" style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 12px; padding: 14px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #facc15; text-transform: uppercase;">Referral Agents Payable</div>
                <div style="font-size: 20px; font-weight: 800; color: #facc15; margin: 4px 0;">${formatCurrency(totalReferralPayable)}</div>
                <div style="font-size: 11px; color: var(--text3);">Commission split to partners</div>
            </div>

            <div class="demo-stat-card" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 14px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #60a5fa; text-transform: uppercase;">Net Company Revenue</div>
                <div style="font-size: 20px; font-weight: 800; color: #60a5fa; margin: 4px 0;">${formatCurrency(netCompanyMargin)}</div>
                <div style="font-size: 11px; color: var(--text3);">Gross Spread after referral</div>
            </div>

            <div class="demo-stat-card" style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 14px 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #c084fc; text-transform: uppercase;">Active SME Advance Balance</div>
                <div style="font-size: 20px; font-weight: 800; color: #c084fc; margin: 4px 0;">${formatCurrency(totalSmeAdvanceBal)}</div>
                <div style="font-size: 11px; color: var(--text3);">${window.smeAdvanceRecords.length} Advance records</div>
            </div>
        `;
    }

    window.switchAccountsTab = function (tabKey) {
        window.currentAccountsTab = tabKey;
        document.querySelectorAll('.acc-tab-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById('accTabBtn_' + tabKey);
        if (activeBtn) activeBtn.classList.add('active');
        window.renderAccountsPage();
    };

    // =========================================================================
    // TAB 1: DISBURSED CASES & BANK PAYOUTS
    // =========================================================================
    function renderDisbursedCasesTab(cases) {
        if (!cases || cases.length === 0) {
            return `
                <div style="text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.01); border: 1px dashed var(--border2); border-radius: 12px;">
                    <i class="fas fa-file-invoice-dollar" style="font-size: 38px; color: var(--gold); opacity: 0.5; margin-bottom: 12px;"></i>
                    <h3 style="color: var(--text); margin-bottom: 6px; font-size: 16px;">No Disbursed Loan Cases Found</h3>
                    <p style="color: var(--text3); font-size: 13px; max-width: 480px; margin: 0 auto 16px;">
                        Move a pipeline or processing lead to "Disbursed" stage to prompt the questionnaire, or click below to record a disbursement directly.
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="window.openSelectLeadToDisburseModal()">
                        <i class="fas fa-plus mr-1"></i> + Record Disbursement
                    </button>
                </div>
            `;
        }

        const rowsHtml = cases.map(c => {
            return `
                <tr style="border-bottom: 1px solid var(--border2); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 14px 18px;">
                        <div style="font-weight: 700; color: var(--text); font-size: 14px;">${window.escapeHtml ? window.escapeHtml(c.customerName) : c.customerName}</div>
                        <div style="font-size: 12px; color: var(--text3); margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                            ${c.phone ? `<span><i class="fas fa-phone mr-1" style="color:#60a5fa; font-size: 11px;"></i>${c.phone}</span>` : ''}
                            <span style="color: var(--gold); font-weight: 600;">${c.category || 'MSME'}</span>
                        </div>
                    </td>
                    <td style="padding: 14px 18px;">
                        <div style="font-weight: 600; color: var(--text); font-size: 13px;">${c.disbursementDate || 'N/A'}</div>
                        <div style="font-size: 12px; color: #34d399; margin-top: 4px; font-weight: 500;" title="Expected Payout Date">
                            <i class="far fa-calendar-check mr-1"></i>Exp: ${c.expectedPayoutDate || 'Next month 15th'}
                        </div>
                    </td>
                    <td style="padding: 14px 18px; text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end;">
                            <button class="btn btn-xs" onclick="window.viewLead('${c.leadId || c.id}')" 
                                    style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" 
                                    title="View Full CRM Lead Profile">
                                <i class="fas fa-eye"></i> View Lead
                            </button>
                            <button class="btn btn-xs" onclick="window.openDisbursementQuestionnaire('${c.leadId || c.id}')" 
                                    style="background: rgba(217, 161, 62, 0.18); color: var(--gold); border: 1px solid rgba(217, 161, 62, 0.45); font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" 
                                    title="View and Edit All Case & Accounts Details in Form">
                                <i class="fas fa-edit"></i> Edit Form
                            </button>
                            <button class="btn btn-xs" onclick="window.viewAccountsVoucher('${c.id}')" 
                                    style="background: rgba(255, 255, 255, 0.06); color: var(--text2); border: 1px solid var(--border2); font-weight: 600; font-size: 11px; padding: 6px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" 
                                    title="View Financial Voucher">
                                <i class="fas fa-receipt text-gold"></i> Voucher
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="tbl-wrap" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border2); border-radius: 10px; overflow: hidden; width: 100%;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border2); background: rgba(0,0,0,0.25); text-align: left; font-size: 11px; color: var(--text3); text-transform: uppercase;">
                            <th style="padding: 12px 18px;">Customer & Case</th>
                            <th style="padding: 12px 18px;">Disbursement & Payout Date</th>
                            <th style="padding: 12px 18px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    // =========================================================================
    // TAB 2: DSA-WISE CASE & PAYOUT HISTORY (Requirement 5)
    // =========================================================================
    function renderDsaHistoryTab(searchQuery) {
        // Group cases by DSA
        const dsaMap = {};

        // Seed with registered DSAs
        window.dsaRecords.forEach(d => {
            dsaMap[d.dsaName.toLowerCase()] = {
                dsaRecord: d,
                dsaName: d.dsaName,
                dsaCode: d.dsaCode,
                contactPerson: d.contactPerson,
                contactNumber: d.contactNumber,
                email: d.email,
                bank: d.bank,
                cases: [],
                totalDisbursed: 0,
                totalPayout: 0
            };
        });

        // Add case records
        window.accountsRecords.forEach(c => {
            const key = (c.dsaName || 'Direct In-House').toLowerCase();
            if (!dsaMap[key]) {
                dsaMap[key] = {
                    dsaRecord: null,
                    dsaName: c.dsaName || 'Direct In-House',
                    dsaCode: c.dsaCode || 'DSA-DIR-001',
                    contactPerson: c.contactedPerson?.name || 'N/A',
                    contactNumber: c.contactedPerson?.phone || 'N/A',
                    email: '',
                    bank: c.bankName || '',
                    cases: [],
                    totalDisbursed: 0,
                    totalPayout: 0
                };
            }
            dsaMap[key].cases.push(c);
            dsaMap[key].totalDisbursed += Number(c.loanAmount) || 0;
            dsaMap[key].totalPayout += Number(c.expectedPayoutAmount) || 0;
        });

        let dsaList = Object.values(dsaMap);

        if (searchQuery) {
            dsaList = dsaList.filter(d =>
                d.dsaName.toLowerCase().includes(searchQuery) ||
                (d.dsaCode && d.dsaCode.toLowerCase().includes(searchQuery)) ||
                (d.contactPerson && d.contactPerson.toLowerCase().includes(searchQuery))
            );
        }

        if (dsaList.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: var(--text3);">
                    No DSA history found matching your search.
                </div>
            `;
        }

        const cardsHtml = dsaList.map(d => {
            const caseRows = d.cases.map(cs => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
                    <div>
                        <span style="font-weight: 700; color: var(--text);">${cs.customerName}</span>
                        <span style="font-size: 11px; color: var(--text3); margin-left: 8px;">(${cs.disbursementDate})</span>
                        <span style="font-size: 10px; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px; margin-left: 6px;">${cs.loanProduct}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #facc15; font-weight: 700;">${formatCurrency(cs.loanAmount)}</span>
                        <span style="color: #34d399; font-weight: 800; margin-left: 12px;">Payout: ${formatCurrency(cs.expectedPayoutAmount)} (${cs.payoutPercentage}%)</span>
                    </div>
                </div>
            `).join('');

            return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 12px; padding: 18px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid var(--border2); padding-bottom: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h3 style="margin: 0; font-size: 16px; color: #fff; font-weight: 800;">${d.dsaName}</h3>
                                <span class="badge" style="background: rgba(217, 161, 62, 0.15); color: var(--gold); border: 1px solid rgba(217, 161, 62, 0.35);">${d.dsaCode || 'DSA'}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text3); margin-top: 4px;">
                                Contact: <span style="color: var(--text); font-weight: 600;">${d.contactPerson}</span> • 
                                Phone: <span style="color: #60a5fa;">${d.contactNumber}</span>
                                ${d.bank ? ` • Empanelled: <span style="color: var(--gold);">${d.bank}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="text-align: right;">
                                <div style="font-size: 10px; color: var(--text3); text-transform: uppercase;">Total Disbursed</div>
                                <div style="font-size: 16px; font-weight: 800; color: #facc15;">${formatCurrency(d.totalDisbursed)}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 10px; color: var(--text3); text-transform: uppercase;">Total Payout Generated</div>
                                <div style="font-size: 16px; font-weight: 800; color: #34d399;">${formatCurrency(d.totalPayout)}</div>
                            </div>
                            <button class="btn btn-xs btn-outline" onclick="window.openAddDsaCommunicationModal('${d.dsaRecord?.id || ''}')" style="padding: 6px 10px;" title="Log New Communication">
                                <i class="fas fa-comment-dots text-gold mr-1"></i> Log Comm
                            </button>
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text3); text-transform: uppercase; margin-bottom: 8px;">
                            <i class="fas fa-history mr-1"></i> Disbursed Cases History (${d.cases.length})
                        </div>
                        ${d.cases.length > 0 ? caseRows : `<div style="font-size: 12px; color: var(--text3); font-style: italic;">No disbursed cases logged under this DSA yet.</div>`}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #fff;">DSA-Wise Case & Payout History Register</h4>
                        <div style="font-size: 11px; color: var(--text3);">Performance, loan volume, and payout analytics grouped by DSA sourcing partners.</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="window.openNewDsaModal()">
                        <i class="fas fa-plus mr-1"></i> + Register New DSA
                    </button>
                </div>
                ${cardsHtml}
            </div>
        `;
    }

    // =========================================================================
    // TAB 3: ADVANCE FROM SME REGISTER (Requirement 10)
    // =========================================================================
    function renderSmeAdvanceTab(searchQuery) {
        let advList = [...window.smeAdvanceRecords];

        if (searchQuery) {
            advList = advList.filter(a =>
                (a.customerName && a.customerName.toLowerCase().includes(searchQuery)) ||
                (a.purpose && a.purpose.toLowerCase().includes(searchQuery)) ||
                (a.relatedCaseDsa && a.relatedCaseDsa.toLowerCase().includes(searchQuery))
            );
        }

        if (advList.length === 0) {
            return `
                <div style="text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.01); border: 1px dashed var(--border2); border-radius: 12px;">
                    <i class="fas fa-coins" style="font-size: 38px; color: var(--gold); opacity: 0.5; margin-bottom: 12px;"></i>
                    <h3 style="color: var(--text); margin-bottom: 6px; font-size: 16px;">No Advance Records from SME Logged</h3>
                    <p style="color: var(--text3); font-size: 13px; max-width: 480px; margin: 0 auto 16px;">
                        Record advances received from SME clients for valuation, legal scrutiny, processing, or retainers.
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="window.openRecordSmeAdvanceModal()">
                        <i class="fas fa-plus mr-1"></i> + Record SME Advance
                    </button>
                </div>
            `;
        }

        const rowsHtml = advList.map(a => {
            const isSettled = Number(a.balanceAmount) <= 0;
            const statusBadge = isSettled
                ? `<span style="background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16, 185, 129, 0.4); padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700;">FULLY ADJUSTED</span>`
                : `<span style="background:rgba(234, 179, 8, 0.15); color:#facc15; border:1px solid rgba(234, 179, 8, 0.4); padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700;">BALANCE PENDING</span>`;

            return `
                <tr style="border-bottom: 1px solid var(--border2);">
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 700; color: var(--text); font-size: 13px;">${window.escapeHtml ? window.escapeHtml(a.customerName) : a.customerName}</div>
                        <div style="font-size: 11px; color: var(--text3);">${a.relatedCaseDsa || 'General SME Case'}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 800; color: #facc15; font-size: 14px;">${formatCurrency(a.advanceAmount)}</div>
                    </td>
                    <td style="padding: 12px 14px; font-size: 12px; color: var(--text2);">
                        ${a.dateReceived || 'N/A'}
                    </td>
                    <td style="padding: 12px 14px;">
                        <div style="font-size: 12px; color: var(--text); font-weight: 600;">${window.escapeHtml ? window.escapeHtml(a.purpose || 'Valuation/Legal') : (a.purpose || 'Valuation/Legal')}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <div style="font-size: 12px; color: #cbd5e1;">${window.escapeHtml ? window.escapeHtml(a.adjustmentDetails || 'Adjusted against payout') : (a.adjustmentDetails || 'Adjusted against payout')}</div>
                        <div style="font-size: 11px; color: #34d399;">Adjusted: ${formatCurrency(a.adjustedAmount)}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 800; color: ${isSettled ? '#34d399' : '#f87171'}; font-size: 14px;">
                            ${formatCurrency(a.balanceAmount)}
                        </div>
                    </td>
                    <td style="padding: 12px 14px;">
                        ${statusBadge}
                    </td>
                    <td style="padding: 12px 14px; text-align: center; white-space: nowrap; position: sticky; right: 0; background: #151a27; z-index: 3; box-shadow: -4px 0 10px rgba(0,0,0,0.45); border-left: 1px solid var(--border2); width: 140px; min-width: 140px;">
                        <button class="btn btn-xs" onclick="window.openAdjustSmeAdvanceModal('${a.id}')" 
                                style="background: rgba(217, 161, 62, 0.18); color: var(--gold); border: 1px solid rgba(217, 161, 62, 0.45); font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" 
                                title="Record Adjustment / Refund">
                            <i class="fas fa-balance-scale text-gold"></i> Adjust
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #fff;">Advance Received from SME Register</h4>
                        <div style="font-size: 11px; color: var(--text3);">Tracking advance amounts, dates, purposes, case/DSA references, adjustments, and balance amounts.</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="window.openRecordSmeAdvanceModal()">
                        <i class="fas fa-plus mr-1"></i> + Record SME Advance
                    </button>
                </div>

                <div class="tbl-wrap" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border2); border-radius: 10px; overflow-x: auto; position: relative;">
                    <table style="width: 100%; min-width: 1100px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border2); background: rgba(0,0,0,0.25); text-align: left; font-size: 11px; color: var(--text3); text-transform: uppercase;">
                                <th style="padding: 10px 14px;">Customer / Case</th>
                                <th style="padding: 10px 14px;">Advance Amount</th>
                                <th style="padding: 10px 14px;">Date Received</th>
                                <th style="padding: 10px 14px;">Purpose</th>
                                <th style="padding: 10px 14px;">Adjustment Details</th>
                                <th style="padding: 10px 14px;">Balance Advance</th>
                                <th style="padding: 10px 14px;">Status</th>
                                <th style="padding: 10px 14px; text-align: center; min-width: 140px; width: 140px; position: sticky; right: 0; background: #191f2e; z-index: 4; box-shadow: -4px 0 10px rgba(0,0,0,0.45); border-left: 1px solid var(--border2);">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // TAB 4: NEW DSA COMMUNICATION LOG (Requirement 14)
    // =========================================================================
    function renderDsaCommunicationTab(searchQuery) {
        let dsaList = [...window.dsaRecords];

        if (searchQuery) {
            dsaList = dsaList.filter(d =>
                d.dsaName.toLowerCase().includes(searchQuery) ||
                (d.contactPerson && d.contactPerson.toLowerCase().includes(searchQuery)) ||
                (d.bank && d.bank.toLowerCase().includes(searchQuery))
            );
        }

        const cardsHtml = dsaList.map(d => {
            const commLogs = (d.communicationHistory || []).map(cm => `
                <div style="border-left: 2px solid var(--gold); padding-left: 12px; margin-bottom: 12px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-weight: 700; color: #facc15; font-size: 12px;">${cm.type || 'Communication'}</span>
                        <span style="font-size: 11px; color: var(--text3);">${cm.date || ''} • by ${cm.by || 'Admin'}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text2); line-height: 1.4;">${window.escapeHtml ? window.escapeHtml(cm.summary) : cm.summary}</div>
                </div>
            `).join('');

            return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-radius: 12px; padding: 18px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid var(--border2); padding-bottom: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h3 style="margin: 0; font-size: 16px; color: #fff; font-weight: 800;">${d.dsaName}</h3>
                                <span class="badge" style="background: rgba(217, 161, 62, 0.15); color: var(--gold); border: 1px solid rgba(217, 161, 62, 0.35);">${d.dsaCode || 'DSA'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; font-size: 12px; color: var(--text2);">
                                <div><i class="fas fa-user text-gold mr-1"></i> Contact: <strong style="color:var(--text);">${d.contactPerson}</strong></div>
                                <div><i class="fas fa-phone mr-1" style="color:#60a5fa;"></i> Mobile: ${d.contactNumber}</div>
                                <div><i class="fas fa-envelope mr-1" style="color:#f472b6;"></i> Email: ${d.email || 'N/A'}</div>
                                <div><i class="fas fa-landmark text-gold mr-1"></i> Bank/NBFC: ${d.bank || 'All Banks'}</div>
                            </div>
                            <div style="margin-top: 8px; font-size: 12px; color: var(--text3);">
                                <span style="color: var(--gold); font-weight: 600;">Payout Terms:</span> ${d.payoutTerms || 'Standard'} • 
                                <span style="color: var(--gold); font-weight: 600;">Agreement:</span> ${d.agreementDetails || 'Executed'} (${d.agreementDate || 'Active'})
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-primary" onclick="window.openAddDsaCommunicationModal('${d.id}')" style="display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fas fa-plus"></i> + Log Communication
                            </button>
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text3); text-transform: uppercase; margin-bottom: 10px;">
                            <i class="fas fa-comments mr-1 text-gold"></i> Initial & Ongoing Communication History (${d.communicationHistory?.length || 0})
                        </div>
                        ${(d.communicationHistory && d.communicationHistory.length > 0) ? commLogs : `<div style="font-size: 12px; color: var(--text3); font-style: italic;">No communication records logged yet. Click "+ Log Communication" to record initial discussion.</div>`}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #fff;">DSA Registry & Initial Communication Log</h4>
                        <div style="font-size: 11px; color: var(--text3);">Recording DSA empanelment, contact officials, agreed payout terms, agreements, and conversation history.</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="window.openNewDsaModal()">
                        <i class="fas fa-plus mr-1"></i> + Register New DSA
                    </button>
                </div>
                ${cardsHtml}
            </div>
        `;
    }

    // =========================================================================
    // TAB 5: REFERRAL AGENT PAYOUTS (Requirements 8 & 9)
    // =========================================================================
    function renderReferralLedgerTab(searchQuery) {
        let referralCases = window.accountsRecords.filter(c => c.referralAgent?.name);

        if (searchQuery) {
            referralCases = referralCases.filter(c =>
                c.customerName.toLowerCase().includes(searchQuery) ||
                (c.referralAgent?.name && c.referralAgent.name.toLowerCase().includes(searchQuery)) ||
                (c.referralAgent?.phone && c.referralAgent.phone.includes(searchQuery))
            );
        }

        if (referralCases.length === 0) {
            return `
                <div style="text-align: center; padding: 48px 20px; color: var(--text3);">
                    No cases with referral agents recorded yet.
                </div>
            `;
        }

        const rowsHtml = referralCases.map(c => {
            const isPaid = c.referralPaymentStatus === 'paid';
            const statusBadge = isPaid
                ? `<span style="background:rgba(16, 185, 129, 0.15); color:#34d399; border:1px solid rgba(16, 185, 129, 0.4); padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700;">PAID</span>`
                : `<span style="background:rgba(234, 179, 8, 0.15); color:#facc15; border:1px solid rgba(234, 179, 8, 0.4); padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700;">UNPAID</span>`;

            return `
                <tr style="border-bottom: 1px solid var(--border2);">
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 700; color: #facc15; font-size: 13px;">${c.referralAgent?.name || 'Agent'}</div>
                        <div style="font-size: 11px; color: var(--text3);">${c.referralAgent?.phone || 'No phone'}</div>
                    </td>
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 600; color: var(--text); font-size: 12px;">${c.customerName}</div>
                        <div style="font-size: 10px; color: var(--text3);">${c.loanProduct} • ${c.bankName}</div>
                    </td>
                    <td style="padding: 12px 14px; font-size: 12px;">${c.disbursementDate}</td>
                    <td style="padding: 12px 14px; font-weight: 700; color: var(--text);">${formatCurrency(c.loanAmount)}</td>
                    <td style="padding: 12px 14px; font-weight: 600; color: var(--gold);">${c.referralPayoutPercentage}%</td>
                    <td style="padding: 12px 14px; font-weight: 800; color: #34d399; font-size: 14px;">${formatCurrency(c.referralPayoutAmount)}</td>
                    <td style="padding: 12px 14px;">${statusBadge}</td>
                    <td style="padding: 12px 14px; text-align: center; white-space: nowrap; position: sticky; right: 0; background: #151a27; z-index: 3; box-shadow: -4px 0 10px rgba(0,0,0,0.45); border-left: 1px solid var(--border2); width: 140px; min-width: 140px;">
                        <button class="btn btn-xs" onclick="window.toggleReferralPaymentStatus('${c.id}')"
                                style="background: ${isPaid ? 'rgba(255,255,255,0.06)' : 'rgba(16, 185, 129, 0.18)'}; color: ${isPaid ? 'var(--text2)' : '#34d399'}; border: 1px solid ${isPaid ? 'var(--border2)' : 'rgba(16, 185, 129, 0.45)'}; font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                            <i class="fas ${isPaid ? 'fa-undo' : 'fa-check'}"></i> ${isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #fff;">Referral Agent Commission Ledger</h4>
                        <div style="font-size: 11px; color: var(--text3);">Tracking referral partner names, contacts, agreed payout percentages, and payment releases.</div>
                    </div>
                </div>

                <div class="tbl-wrap" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border2); border-radius: 10px; overflow-x: auto; position: relative;">
                    <table style="width: 100%; min-width: 1150px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border2); background: rgba(0,0,0,0.25); text-align: left; font-size: 11px; color: var(--text3); text-transform: uppercase;">
                                <th style="padding: 10px 14px;">Referral Agent</th>
                                <th style="padding: 10px 14px;">Linked Customer & Loan</th>
                                <th style="padding: 10px 14px;">Disbursement Date</th>
                                <th style="padding: 10px 14px;">Loan Amount</th>
                                <th style="padding: 10px 14px;">Referral %</th>
                                <th style="padding: 10px 14px;">Calculated Payout</th>
                                <th style="padding: 10px 14px;">Payment Status</th>
                                <th style="padding: 10px 14px; text-align: center; min-width: 140px; width: 140px; position: sticky; right: 0; background: #191f2e; z-index: 4; box-shadow: -4px 0 10px rgba(0,0,0,0.45); border-left: 1px solid var(--border2);">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // MODAL DIALOGS FOR ACCOUNTS
    // =========================================================================

    // 1. Select Lead to Disburse Modal
    window.openSelectLeadToDisburseModal = function () {
        const activeLeads = (window.leads || []).filter(l => l && l.status !== 'dump' && l.status !== 'rejected');
        
        const optionsHtml = activeLeads.map(l => `
            <option value="${l.id}">
                ${l.name || 'Client'} - ₹ ${(Number(l.amount || 0)).toLocaleString('en-IN')} (${l.loanType || l.product || 'Loan'}) [${l.status || 'Active'}]
            </option>
        `).join('');

        const bodyHtml = `
            <div class="fg">
                <label style="font-size: 12px; font-weight: 700; color: var(--text2);">Select Active Lead to Disburse:</label>
                <select id="selectLeadForDisbursal" class="tb-search" style="width: 100%; height: 42px;">
                    ${optionsHtml}
                </select>
                <div style="font-size: 11px; color: var(--text3); margin-top: 6px;">
                    Selecting this case will launch the 14-point Financial & Payout Questionnaire to complete the disbursement.
                </div>
            </div>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="
                const id = document.getElementById('selectLeadForDisbursal').value;
                closeModal();
                if(id) window.openDisbursementQuestionnaire(id);
            ">
                Continue to Questionnaire <i class="fas fa-arrow-right ml-1"></i>
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal('Select Case to Disburse', bodyHtml, footHtml, 'sm');
        }
    };

    // 2. New DSA Modal (Requirement 14)
    window.openNewDsaModal = function () {
        const banksOptions = BANKS_LIST.map(b => `<option value="${b}">${b}</option>`).join('');

        const bodyHtml = `
            <form id="newDsaForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">DSA Company / Firm Name *</label>
                    <input type="text" id="newDsaName" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Nexus Capital Advisors" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Contact Person Name *</label>
                        <input type="text" id="newDsaContactPerson" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Sunil Deshmukh" required>
                    </div>
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Contact Mobile No. *</label>
                        <input type="tel" id="newDsaContactNumber" class="tb-search" style="width: 100%; height: 38px;" maxlength="20" placeholder="e.g. +91 9811223344 (up to 15 digits)" required>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Official Email</label>
                        <input type="email" id="newDsaEmail" class="tb-search" style="width: 100%; height: 38px;" placeholder="contact@nexuscapital.com">
                    </div>
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Primary Bank / NBFC Empanelment</label>
                        <input list="dsaBankList" id="newDsaBank" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. HDFC Bank, Tata Capital">
                        <datalist id="dsaBankList">${banksOptions}</datalist>
                    </div>
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Agreed Payout Terms</label>
                    <input type="text" id="newDsaPayoutTerms" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. 1.75% for MSME Unsecured, 1.25% for Secured LAP">
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Agreement / Empanelment Details</label>
                        <input type="text" id="newDsaAgreementDetails" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Non-exclusive sourcing tie-up executed">
                    </div>
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Agreement Date</label>
                        <input type="date" id="newDsaAgreementDate" class="tb-search" style="width: 100%; height: 38px;" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Initial Communication Notes / Summary</label>
                    <textarea id="newDsaInitialComm" class="tb-search" rows="2" style="width: 100%; resize: vertical;" placeholder="Details of initial meeting, call, or discussion with DSA..."></textarea>
                </div>
            </form>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.saveNewDsaRecord()">
                <i class="fas fa-check mr-1"></i> Register DSA & Log Communication
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal('<i class="fas fa-handshake text-gold mr-1"></i> Register New DSA & Initial Communication', bodyHtml, footHtml, 'md');
        }
    };

    window.saveNewDsaRecord = function () {
        const name = document.getElementById('newDsaName')?.value?.trim();
        const contactPerson = document.getElementById('newDsaContactPerson')?.value?.trim();
        const contactNumber = document.getElementById('newDsaContactNumber')?.value?.trim();
        const email = document.getElementById('newDsaEmail')?.value?.trim();
        const bank = document.getElementById('newDsaBank')?.value?.trim();
        const payoutTerms = document.getElementById('newDsaPayoutTerms')?.value?.trim();
        const agreementDetails = document.getElementById('newDsaAgreementDetails')?.value?.trim();
        const agreementDate = document.getElementById('newDsaAgreementDate')?.value;
        const initialComm = document.getElementById('newDsaInitialComm')?.value?.trim();

        if (!name || !contactPerson || !contactNumber) {
            if (typeof window.toast === 'function') window.toast('Please fill in DSA Name, Contact Person, and Mobile Number.', 'warning');
            return;
        }

        const dsaCode = 'DSA-' + name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

        const newDsa = {
            id: 'dsa_' + Date.now(),
            dsaName: name,
            dsaCode: dsaCode,
            contactPerson: contactPerson,
            contactNumber: contactNumber,
            email: email,
            bank: bank,
            payoutTerms: payoutTerms || 'Standard agreed commission',
            agreementDetails: agreementDetails || 'Tie-up registered',
            agreementDate: agreementDate,
            status: 'active',
            communicationHistory: initialComm ? [
                {
                    id: 'comm_' + Date.now(),
                    date: agreementDate || new Date().toISOString().split('T')[0],
                    type: 'Initial Tie-up Discussion',
                    summary: initialComm,
                    by: window.currentUser?.displayName || 'Admin'
                }
            ] : []
        };

        window.dsaRecords.unshift(newDsa);
        saveDsaRecords();

        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.toast === 'function') window.toast(`DSA ${name} registered successfully!`, 'success');

        window.renderAccountsPage();
    };

    // 3. Add DSA Communication Modal
    window.openAddDsaCommunicationModal = function (dsaId) {
        const dsa = window.dsaRecords.find(d => d.id === dsaId);
        if (!dsa) {
            if (typeof window.toast === 'function') window.toast('DSA not found', 'error');
            return;
        }

        const bodyHtml = `
            <div class="fg">
                <label style="font-size: 11px; font-weight: 700; color: var(--text2);">DSA:</label>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">${dsa.dsaName} (${dsa.contactPerson})</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Communication Type</label>
                    <select id="addCommType" class="tb-search" style="width: 100%; height: 38px;">
                        <option value="Phone Call">Phone Call</option>
                        <option value="In-Person Meeting">In-Person Meeting</option>
                        <option value="Email Discussion">Email Discussion</option>
                        <option value="WhatsApp / Message">WhatsApp / Message</option>
                        <option value="Case Status Follow-up">Case Status Follow-up</option>
                    </select>
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Date</label>
                    <input type="date" id="addCommDate" class="tb-search" style="width: 100%; height: 38px;" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>
            <div class="fg" style="margin-top: 10px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Communication Summary & Notes *</label>
                <textarea id="addCommSummary" class="tb-search" rows="3" style="width: 100%; resize: vertical;" placeholder="Enter details of the discussion, agreed terms, or case follow-up..."></textarea>
            </div>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="
                const summary = document.getElementById('addCommSummary').value.trim();
                const type = document.getElementById('addCommType').value;
                const date = document.getElementById('addCommDate').value;
                if(!summary) { alert('Please enter summary notes'); return; }
                const dsa = window.dsaRecords.find(d => d.id === '${dsaId}');
                if(dsa) {
                    dsa.communicationHistory = dsa.communicationHistory || [];
                    dsa.communicationHistory.unshift({
                        id: 'comm_' + Date.now(),
                        date: date,
                        type: type,
                        summary: summary,
                        by: window.currentUser?.displayName || 'User'
                    });
                    localStorage.setItem('crm_dsa_records', JSON.stringify(window.dsaRecords));
                }
                closeModal();
                toast('Communication logged successfully', 'success');
                renderAccountsPage();
            ">
                <i class="fas fa-save mr-1"></i> Save Communication
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal(`Log Communication - ${dsa.dsaName}`, bodyHtml, footHtml, 'sm');
        }
    };

    // 4. Record SME Advance Modal
    window.openRecordSmeAdvanceModal = function () {
        const bodyHtml = `
            <form id="newSmeAdvForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Customer / SME Enterprise Name *</label>
                    <input type="text" id="smeAdvCustName" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Apex Industrial Solutions" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Advance Amount (₹) *</label>
                        <input type="number" min="0" id="smeAdvAmount" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" placeholder="e.g. 25000" required>
                    </div>
                    <div class="fg">
                        <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Date Received *</label>
                        <input type="date" id="smeAdvDate" class="tb-search" style="width: 100%; height: 38px;" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Advance Purpose *</label>
                    <input type="text" id="smeAdvPurpose" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Property valuation & legal search fee" required>
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Related Case / DSA Reference</label>
                    <input type="text" id="smeAdvRelated" class="tb-search" style="width: 100%; height: 38px;" placeholder="e.g. Case #BL-992 / FinGrow Partners">
                </div>
                <div class="fg">
                    <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Adjustment Terms / Details</label>
                    <input type="text" id="smeAdvAdjustDetails" class="tb-search" style="width: 100%; height: 38px;" value="To be adjusted against commission on final disbursement" placeholder="e.g. Adjusted from final commission / Refundable">
                </div>
            </form>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="
                const cust = document.getElementById('smeAdvCustName').value.trim();
                const amt = Number(document.getElementById('smeAdvAmount').value) || 0;
                const dt = document.getElementById('smeAdvDate').value;
                const purp = document.getElementById('smeAdvPurpose').value.trim();
                const rel = document.getElementById('smeAdvRelated').value.trim();
                const adj = document.getElementById('smeAdvAdjustDetails').value.trim();
                if(!cust || amt <= 0 || !dt) { alert('Please enter Customer, Amount, and Date'); return; }
                window.smeAdvanceRecords.unshift({
                    id: 'sme_adv_' + Date.now(),
                    customerName: cust,
                    advanceAmount: amt,
                    dateReceived: dt,
                    purpose: purp || 'Valuation/Legal fee',
                    relatedCaseDsa: rel || cust,
                    adjustmentDetails: adj,
                    adjustedAmount: 0,
                    balanceAmount: amt,
                    status: 'active',
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem('crm_sme_advance_records', JSON.stringify(window.smeAdvanceRecords));
                closeModal();
                toast('SME advance recorded successfully', 'success');
                renderAccountsPage();
            ">
                <i class="fas fa-check mr-1"></i> Record Advance
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal('<i class="fas fa-coins text-gold mr-1"></i> Record Advance from SME', bodyHtml, footHtml, 'sm');
        }
    };

    // 5. Adjust SME Advance Modal
    window.openAdjustSmeAdvanceModal = function (advId) {
        const adv = window.smeAdvanceRecords.find(a => a.id === advId);
        if (!adv) return;

        const bodyHtml = `
            <div class="fg">
                <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Customer:</label>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">${adv.customerName}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                <div>
                    <div style="font-size: 11px; color: var(--text3);">Total Advance Received:</div>
                    <div style="font-size: 14px; font-weight: 800; color: #facc15;">${formatCurrency(adv.advanceAmount)}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: var(--text3);">Current Balance:</div>
                    <div style="font-size: 14px; font-weight: 800; color: #34d399;">${formatCurrency(adv.balanceAmount)}</div>
                </div>
            </div>
            <div class="fg" style="margin-top: 12px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Total Adjusted / Deducted Amount (₹) *</label>
                <input type="number" min="0" max="${adv.advanceAmount}" id="editSmeAdjustedAmt" class="tb-search" style="width: 100%; height: 38px; font-weight: 700;" value="${adv.adjustedAmount}">
            </div>
            <div class="fg" style="margin-top: 10px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--text2);">Adjustment Note / Settlement Voucher</label>
                <input type="text" id="editSmeAdjustNote" class="tb-search" style="width: 100%; height: 38px;" value="${adv.adjustmentDetails || ''}">
            </div>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="
                const adjAmt = Number(document.getElementById('editSmeAdjustedAmt').value) || 0;
                const note = document.getElementById('editSmeAdjustNote').value.trim();
                const target = window.smeAdvanceRecords.find(a => a.id === '${advId}');
                if(target) {
                    target.adjustedAmount = adjAmt;
                    target.balanceAmount = target.advanceAmount - adjAmt;
                    target.adjustmentDetails = note;
                    target.status = target.balanceAmount <= 0 ? 'adjusted' : 'active';
                    localStorage.setItem('crm_sme_advance_records', JSON.stringify(window.smeAdvanceRecords));
                }
                closeModal();
                toast('SME advance adjusted successfully', 'success');
                renderAccountsPage();
            ">
                <i class="fas fa-check mr-1"></i> Update Adjustment
            </button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal(`Adjust SME Advance - ${adv.customerName}`, bodyHtml, footHtml, 'sm');
        }
    };

    // 6. View Financial Voucher Modal
    window.viewAccountsVoucher = function (accId) {
        const c = window.accountsRecords.find(a => a.id === accId);
        if (!c) return;

        const bodyHtml = `
            <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border2); border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border2); padding-bottom: 14px; margin-bottom: 14px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 800; color: var(--gold);">LOANITOL ACCOUNTS VOUCHER</div>
                        <div style="font-size: 12px; color: var(--text3);">Voucher Ref: ${c.id}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; font-weight: 700; color: #34d399;">Disbursed on: ${c.disbursementDate}</div>
                        <div style="font-size: 11px; color: var(--text3);">Cycle: ${c.expectedPayoutDate}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 13px; line-height: 1.6;">
                    <div>
                        <div style="color: var(--text3); font-size: 11px;">CUSTOMER DETAILS</div>
                        <div style="font-weight: 700; color: #fff; font-size: 15px;">${c.customerName}</div>
                        <div>Phone: ${c.phone || 'N/A'}</div>
                        <div>Category: ${c.category || 'MSME'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text3); font-size: 11px;">FINANCIAL INSTITUTION</div>
                        <div style="font-weight: 700; color: var(--gold); font-size: 15px;">${c.bankName}</div>
                        <div>Official: ${c.contactedPerson?.name || 'N/A'} (${c.contactedPerson?.phone || ''})</div>
                        <div>Product: ${c.loanProduct}</div>
                    </div>
                </div>

                <div style="margin-top: 18px; border-top: 1px solid var(--border2); padding-top: 14px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr style="border-bottom: 1px solid var(--border2);">
                            <td style="padding: 6px 0; color: var(--text2);">Sanctioned / Disbursed Loan Amount</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #facc15;">${formatCurrency(c.loanAmount)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid var(--border2);">
                            <td style="padding: 6px 0; color: var(--text2);">Agreed Bank Payout (${c.payoutPercentage}%)</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #34d399;">${formatCurrency(c.expectedPayoutAmount)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid var(--border2);">
                            <td style="padding: 6px 0; color: var(--text2);">Referral Agent Share: ${c.referralAgent?.name || 'None'} (${c.referralPayoutPercentage || 0}%)</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #f87171;">-${formatCurrency(c.referralPayoutAmount || 0)}</td>
                        </tr>
                        <tr style="border-top: 2px solid var(--gold);">
                            <td style="padding: 8px 0; font-weight: 800; color: #fff;">Net Company Spread / Margin</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #60a5fa; font-size: 16px;">${formatCurrency(c.netCompanyMargin)}</td>
                        </tr>
                    </table>
                </div>

                ${c.advanceFromSme?.hasAdvance ? `
                    <div style="margin-top: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; padding: 10px 14px; font-size: 12px;">
                        <div style="font-weight: 700; color: var(--gold);">SME Advance Tracking:</div>
                        <div>Advance Received: ${formatCurrency(c.advanceFromSme.advanceAmount)} | Adjusted: ${formatCurrency(c.advanceFromSme.adjustedAmount)} | Balance: ${formatCurrency(c.advanceFromSme.balanceAmount)}</div>
                        <div style="color: var(--text3); font-size: 11px;">Adjustment: ${c.advanceFromSme.adjustmentDetails || 'Standard adjustment'}</div>
                    </div>
                ` : ''}
            </div>
        `;

        const footHtml = `
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
            <button class="btn btn-secondary" onclick="window.print()"><i class="fas fa-print mr-1"></i> Print Voucher</button>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal(`Accounts Voucher - ${c.customerName}`, bodyHtml, footHtml, 'md');
        }
    };

    // Quick Status Toggles
    window.toggleAccountsPayoutStatus = function (accId) {
        const c = window.accountsRecords.find(a => a.id === accId);
        if (!c) return;
        c.payoutStatus = (c.payoutStatus === 'received') ? 'pending' : 'received';
        saveAccountsRecords();
        if (typeof window.toast === 'function') {
            window.toast(`Bank Payout marked as ${c.payoutStatus.toUpperCase()}`, 'success');
        }
        window.renderAccountsPage();
    };

    window.toggleReferralPaymentStatus = function (accId) {
        const c = window.accountsRecords.find(a => a.id === accId);
        if (!c) return;
        c.referralPaymentStatus = (c.referralPaymentStatus === 'paid') ? 'unpaid' : 'paid';
        saveAccountsRecords();
        if (typeof window.toast === 'function') {
            window.toast(`Referral Payout marked as ${c.referralPaymentStatus.toUpperCase()}`, 'success');
        }
        window.renderAccountsPage();
    };

    // Excel / CSV Exporter
    window.exportAccountsToExcel = function () {
        if (!window.accountsRecords || window.accountsRecords.length === 0) {
            if (typeof window.toast === 'function') window.toast('No accounts records to export', 'warning');
            return;
        }

        const headers = [
            'Case ID',
            'Customer Name',
            'Phone',
            'Category',
            'Disbursement Date',
            'Expected Payout Date',
            'Loan Product',
            'Disbursed Amount (₹)',
            'Bank / NBFC',
            'Bank Contact Person',
            'DSA Partner',
            'Agreed Payout %',
            'Expected Bank Payout (₹)',
            'Referral Agent',
            'Referral Payout %',
            'Referral Payout Amount (₹)',
            'Net Company Spread (₹)',
            'Payout Status',
            'Referral Status'
        ];

        const rows = window.accountsRecords.map(c => [
            c.id,
            `"${(c.customerName || '').replace(/"/g, '""')}"`,
            c.phone || '',
            c.category || '',
            c.disbursementDate || '',
            c.expectedPayoutDate || '',
            `"${(c.loanProduct || '').replace(/"/g, '""')}"`,
            c.loanAmount || 0,
            `"${(c.bankName || '').replace(/"/g, '""')}"`,
            `"${(c.contactedPerson?.name || '').replace(/"/g, '""')}"`,
            `"${(c.dsaName || '').replace(/"/g, '""')}"`,
            c.payoutPercentage || 0,
            c.expectedPayoutAmount || 0,
            `"${(c.referralAgent?.name || '').replace(/"/g, '""')}"`,
            c.referralPayoutPercentage || 0,
            c.referralPayoutAmount || 0,
            c.netCompanyMargin || 0,
            c.payoutStatus || 'pending',
            c.referralPaymentStatus || 'unpaid'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Loanitol_Accounts_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof window.toast === 'function') window.toast('Accounts ledger exported successfully!', 'success');
    };

    // Self-initialize data
    initAccountsData();

})();

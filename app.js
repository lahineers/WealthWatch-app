let portfolio = [];
let transactions = [];

const API_BASE = "http://localhost:3000/api";
const API_KEY = "8805673262034430a8368a0ecbb17408";

/* ── CHART COLORS ── */
const COLORS = ["#378ADD","#F0997B","#ED93B1","#1D9E75","#9FE1CB","#FAC775","#AFA9EC","#5DCAA5"];

/* ── LOGIN ── */
async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    window.location.href = "home.html";
  } catch (e) {
    alert("Could not connect to server");
  }
}

async function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const res  = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    window.location.href = "home.html";
  } catch (e) {
    alert("Could not connect to server");
  }
}

let isRegisterMode = false;
function toggleRegister() {
  isRegisterMode = !isRegisterMode;
  const mainBtn = document.getElementById("mainBtn");
  const tagline = document.getElementById("loginTagline");
  const toggle  = mainBtn?.nextElementSibling;
  if (isRegisterMode) {
    if (mainBtn) { mainBtn.textContent = "Create account"; mainBtn.setAttribute("onclick", "register()"); }
    if (tagline) tagline.textContent = "Create your account";
    if (toggle)  toggle.textContent  = "Already have an account? Sign in";
  } else {
    if (mainBtn) { mainBtn.textContent = "Sign in"; mainBtn.setAttribute("onclick", "login()"); }
    if (tagline) tagline.textContent = "Sign in to your portfolio";
    if (toggle)  toggle.textContent  = "Create account";
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

/* ── PAGE PROTECTION ── */
async function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "login.html"; return; }
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }
  } catch (e) { /* server unreachable */ }
}

if (
  window.location.pathname.includes("home.html") ||
  window.location.pathname.includes("portfolio.html") ||
  window.location.pathname.includes("transactions.html")
) {
  checkAuth();
}

/* ── NAVIGATION ── */
function showHome()         { window.location.href = "home.html"; }
function showPortfolio()    { window.location.href = "portfolio.html"; }
function showTransactions() { window.location.href = "transactions.html"; }

/* ── LOAD TRANSACTIONS FROM DB ── */
async function loadTransactions() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/portfolio/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error("Failed to load transactions, status:", res.status);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      transactions = data;
      rebuildPortfolio();
    }
    retryPendingTransactions();
  } catch (e) {
    console.error("Could not load transactions", e);
  }
}

/* ── SAVE TRANSACTIONS TO DB ── */
async function saveTransactions() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/portfolio/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ transactions })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert("Failed to save data: " + (err?.error || `Server error ${res.status}`));
      localStorage.setItem("pendingTransactions", JSON.stringify(transactions));
    }
  } catch (e) {
    console.error("Could not save transactions", e);
    localStorage.setItem("pendingTransactions", JSON.stringify(transactions));
    alert("Cannot connect to server. Data saved locally and will sync when server is back.");
  }
}

/* ── RETRY SAVED TRANSACTIONS ── */
async function retryPendingTransactions() {
  const pending = localStorage.getItem("pendingTransactions");
  if (!pending) return;
  try {
    transactions = JSON.parse(pending);
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_BASE}/portfolio/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ transactions })
    });
    if (res.ok) {
      localStorage.removeItem("pendingTransactions");
    }
    rebuildPortfolio();
  } catch (e) {
    console.error("Retry pending transactions failed", e);
  }
}

/* ── REBUILD PORTFOLIO FROM TRANSACTIONS ── */
function rebuildPortfolio() {
  portfolio = [];
  transactions.forEach(tx => {
    const existing = portfolio.find(s => s.symbol === tx.symbol);
    if (existing) {
      const totalQty = existing.qty + tx.qty;
      const avgBuy = ((existing.qty * existing.buyPrice) + (tx.qty * tx.price)) / totalQty;
      existing.qty = totalQty;
      existing.buyPrice = Math.round(avgBuy);
      existing.category = tx.category;
    } else {
      portfolio.push({ symbol: tx.symbol, qty: tx.qty, buyPrice: tx.price, currentPrice: tx.price, category: tx.category });
    }
  });
}

/* ── LIVE PRICES ── */
async function updateLivePrices() {
  if (portfolio.length === 0) return;
  const symbols = portfolio.map(s => s.symbol).join(",");
  try {
    const response = await fetch(`https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${API_KEY}`);
    const data = await response.json();
    portfolio.forEach(stock => {
      if (data[stock.symbol] && data[stock.symbol].close) {
        stock.currentPrice = Math.round(Number(data[stock.symbol].close));
      } else if (data.close) {
        stock.currentPrice = Math.round(Number(data.close));
      } else {
        stock.currentPrice = stock.buyPrice;
      }
    });
  } catch (e) { console.log(e); }
}

/* ── PORTFOLIO TABLE ── */
function renderPortfolioTable() {
  const container = document.getElementById("portfolioTable");
  if (!container) return;

  let totalInvestment = 0, totalCurrent = 0;

  container.innerHTML = portfolio.map((stock, index) => {
    const invested = stock.buyPrice * stock.qty;
    const currentValue = stock.currentPrice * stock.qty;
    const profit = currentValue - invested;
    const returnPercent = ((stock.currentPrice - stock.buyPrice) / stock.buyPrice) * 100;
    totalInvestment += invested;
    totalCurrent += currentValue;

    const profitBadge = profit >= 0
      ? `<span class="green-badge">+$${profit.toFixed(2)}</span>`
      : `<span class="red-badge">-$${Math.abs(profit).toFixed(2)}</span>`;

    const retBadge = returnPercent >= 0
      ? `<span class="green-badge">+${returnPercent.toFixed(2)}%</span>`
      : `<span class="red-badge">${returnPercent.toFixed(2)}%</span>`;

    return `
      <tr>
        <td>
          <div class="instrument-name">${stock.symbol}</div>
          <div class="instrument-meta">${stock.qty} shares &middot; Avg. $${stock.buyPrice}</div>
          <div class="instrument-meta">${stock.category}</div>
        </td>
        <td style="font-family:var(--font-mono)">$${stock.currentPrice}</td>
        <td style="font-family:var(--font-mono)">$${invested.toFixed(2)}</td>
        <td style="font-family:var(--font-mono)">$${currentValue.toFixed(2)}</td>
        <td>${profitBadge}</td>
        <td>${retBadge}</td>
        <td><button class="btn-delete" onclick="deleteStock(${index})">Remove</button></td>
      </tr>`;
  }).join("");

  const totalProfit = totalCurrent - totalInvestment;
  const returnPct = totalInvestment > 0 ? ((totalProfit / totalInvestment) * 100).toFixed(2) : "0.00";

  document.getElementById("totalInvestment").innerText = "$" + totalInvestment.toFixed(2);
  document.getElementById("totalCurrent").innerText = "$" + totalCurrent.toFixed(2);

  const profEl = document.getElementById("totalProfit");
  if (profEl) {
    profEl.innerHTML = totalProfit >= 0
      ? `<span class="green">+$${totalProfit.toFixed(2)} (${returnPct}%)</span>`
      : `<span class="red">-$${Math.abs(totalProfit).toFixed(2)} (${returnPct}%)</span>`;
  }
}

/* ── DASHBOARD ── */
function updateDashboard() {
  let totalInvestment = 0, totalCurrent = 0;
  portfolio.forEach(stock => {
    totalInvestment += stock.buyPrice * stock.qty;
    totalCurrent += stock.currentPrice * stock.qty;
  });
  const totalProfit = totalCurrent - totalInvestment;
  const returnPct = totalInvestment > 0 ? ((totalProfit / totalInvestment) * 100) : 0;

  const inv  = document.getElementById("dashboardInvestment");
  const cur  = document.getElementById("dashboardCurrent");
  const prof = document.getElementById("dashboardProfit");
  const pct  = document.getElementById("dashboardReturnPct");
  const cnt  = document.getElementById("holdingsCount");
  const pos  = document.getElementById("positionCount");

  if (!inv) return;

  inv.innerText = "$" + totalInvestment.toFixed(2);
  cur.innerText = "$" + totalCurrent.toFixed(2);

  if (pct) {
    pct.innerText = (returnPct >= 0 ? "+" : "") + returnPct.toFixed(2) + "%";
    pct.style.color = returnPct >= 0 ? "var(--green-text)" : "var(--red)";
  }

  if (prof) {
    prof.innerHTML = totalProfit >= 0
      ? `<span class="green">+$${totalProfit.toFixed(2)}</span>`
      : `<span class="red">-$${Math.abs(totalProfit).toFixed(2)}</span>`;
  }

  if (cnt) cnt.innerText = portfolio.length + " holdings";
  if (pos) pos.innerText = portfolio.length;
}

/* ── CHARTS ── */
let chartInstances = {};

async function renderChart() {
  renderDonut();
  await renderLineChart();
  renderPerformerTables();
  renderCategoryChart();
  renderHoldingsList();
}

function renderDonut() {
  const ctx = document.getElementById("portfolioChart");
  if (!ctx) return;
  if (chartInstances.donut) chartInstances.donut.destroy();

  const labels   = portfolio.map(s => s.symbol);
  const values   = portfolio.map(s => s.currentPrice * s.qty);
  const total    = values.reduce((a, b) => a + b, 0);
  const bgColors = portfolio.map((_, i) => COLORS[i % COLORS.length]);

  const legendEl = document.getElementById("donutLegend");
  if (legendEl) {
    legendEl.innerHTML = labels.map((label, i) => {
      const pct = total > 0 ? ((values[i] / total) * 100).toFixed(0) : 0;
      return `<span><span class="legend-dot" style="background:${bgColors[i]}"></span>${label} ${pct}%</span>`;
    }).join("");
  }

  chartInstances.donut = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: { legend: { display: false } }
    }
  });
}

async function renderLineChart() {
  const ctx = document.getElementById("lineChart");
  if (!ctx || portfolio.length === 0) return;
  if (chartInstances.line) chartInstances.line.destroy();

  const card  = ctx.closest(".card");
  const subEl = card ? card.querySelector(".card-sub") : null;

  const datedTx = transactions.filter(tx => tx.date);
  if (datedTx.length === 0) {
    if (subEl) subEl.innerText = "Add a date to your transactions to see real history";
    return;
  }

  const startDate = datedTx.map(tx => tx.date).sort()[0];
  if (subEl) subEl.innerText = "Loading from " + startDate + "...";

  const start      = new Date(startDate);
  const today      = new Date();
  const daysDiff   = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
  const interval   = daysDiff <= 90 ? "1day" : "1week";
  const outputsize = Math.min(daysDiff + 5, 5000);

  try {
    const results = await Promise.all(
      portfolio.map(s =>
        fetch(`https://api.twelvedata.com/time_series?symbol=${s.symbol}&interval=${interval}&outputsize=${outputsize}&start_date=${startDate}&apikey=${API_KEY}`)
          .then(r => r.json())
      )
    );

    const firstBuyDate = {};
    transactions.forEach(tx => {
      if (!tx.date) return;
      if (!firstBuyDate[tx.symbol] || tx.date < firstBuyDate[tx.symbol])
        firstBuyDate[tx.symbol] = tx.date;
    });

    const dateValueMap = {};
    results.forEach((data, i) => {
      const stock = portfolio[i];
      if (!data.values || data.status === "error") return;
      const buyDate = firstBuyDate[stock.symbol] || startDate;
      data.values.forEach(bar => {
        if (bar.datetime < buyDate) return;
        dateValueMap[bar.datetime] = (dateValueMap[bar.datetime] || 0) + parseFloat(bar.close) * stock.qty;
      });
    });

    const sortedDates = Object.keys(dateValueMap).sort();
    const labels = sortedDates.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    const values = sortedDates.map(d => Math.round(dateValueMap[d]));

    if (subEl) subEl.innerText = (interval === "1day" ? "Daily" : "Weekly") + " since " + startDate;

    chartInstances.line = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: "#1D9E75",
          backgroundColor: "rgba(29,158,117,0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: daysDiff <= 30 ? 3 : 0,
          pointBackgroundColor: "#1D9E75",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9ca3af", font: { size: 11 }, maxTicksLimit: 8, maxRotation: 0 } },
          y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9ca3af", font: { size: 11 }, callback: v => "$" + v.toLocaleString() } }
        }
      }
    });

  } catch (e) {
    console.error("Historical chart error:", e);
    if (subEl) subEl.innerText = "Could not load historical data";
  }
}

function renderPerformerTables() {
  const top    = document.getElementById("topPerformersTable");
  const bottom = document.getElementById("bottomPerformersTable");
  if (!top || !bottom || portfolio.length === 0) return;

  const ranked = portfolio.map(s => ({
    symbol: s.symbol,
    category: s.category,
    returnPct: ((s.currentPrice - s.buyPrice) / s.buyPrice) * 100,
    value: s.currentPrice * s.qty
  })).sort((a, b) => b.returnPct - a.returnPct);

  const thead = `<thead><tr><th>Stock</th><th style="text-align:right">Value</th><th style="text-align:right">Return</th></tr></thead>`;

  const rowHTML = s => {
    const badge = s.returnPct >= 0
      ? `<span class="green-badge">+${s.returnPct.toFixed(2)}%</span>`
      : `<span class="red-badge">${s.returnPct.toFixed(2)}%</span>`;
    return `<tr>
      <td>
        <div class="instrument-name">${s.symbol}</div>
        <div class="instrument-meta">${s.category}</div>
      </td>
      <td style="font-family:var(--font-mono);text-align:right">$${s.value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="text-align:right">${badge}</td>
    </tr>`;
  };

  top.innerHTML    = thead + `<tbody>${ranked.slice(0, 5).map(rowHTML).join("")}</tbody>`;
  bottom.innerHTML = thead + `<tbody>${ranked.slice(-5).reverse().map(rowHTML).join("")}</tbody>`;
}

function renderCategoryChart() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx || portfolio.length === 0) return;
  if (chartInstances.category) chartInstances.category.destroy();

  const catMap = {};
  portfolio.forEach(s => {
    catMap[s.category] = (catMap[s.category] || 0) + s.currentPrice * s.qty;
  });

  const labels   = Object.keys(catMap);
  const values   = labels.map(c => Math.round(catMap[c]));
  const total    = values.reduce((a, b) => a + b, 0);
  const bgColors = labels.map((_, i) => COLORS[i % COLORS.length]);

  const legendEl = document.getElementById("categoryLegend");
  if (legendEl) {
    legendEl.innerHTML = labels.map((label, i) => {
      const pct = total > 0 ? ((values[i] / total) * 100).toFixed(0) : 0;
      return `<span><span class="legend-dot" style="background:${bgColors[i]}"></span>${label} ${pct}%</span>`;
    }).join("");
  }

  chartInstances.category = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: { legend: { display: false } }
    }
  });
}

function renderHoldingsList() {
  const el = document.getElementById("holdingsList");
  if (!el || portfolio.length === 0) return;

  const totalVal = portfolio.reduce((sum, s) => sum + s.currentPrice * s.qty, 0);

  const rows = portfolio.map((s, i) => {
    const val   = s.currentPrice * s.qty;
    const pct   = totalVal > 0 ? (val / totalVal * 100) : 0;
    const ret   = ((s.currentPrice - s.buyPrice) / s.buyPrice * 100).toFixed(2);
    const color = COLORS[i % COLORS.length];

    return `
      <div class="holding-row">
        <div>
          <div class="instrument-name">${s.symbol}</div>
          <div class="instrument-meta">${s.category}</div>
        </div>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${Math.round(pct)}%;background:${color}"></div>
        </div>
        <div>
          <div class="h-val">$${val.toLocaleString()}</div>
          <div class="h-chg ${parseFloat(ret) >= 0 ? 'green' : 'red'}">${parseFloat(ret) >= 0 ? '+' : ''}${ret}%</div>
        </div>
      </div>`;
  }).join("");

  el.innerHTML = `<div style="max-height:320px;overflow-y:auto;padding-right:4px">${rows}</div>`;
}

/* ── TRANSACTIONS ── */
async function addTransaction() {
  const symbol   = document.getElementById("txSymbol").value.toUpperCase().trim();
  const qty      = Number(document.getElementById("txQty").value);
  const price    = Number(document.getElementById("txPrice").value);
  const category = document.getElementById("txCategory").value;
  const date     = document.getElementById("txDate").value;

  if (!symbol || !qty || !price || !category || !date) { alert("Fill all fields"); return; }

  transactions.push({ symbol, qty, price, category, date });
  await saveTransactions();

  rebuildPortfolio();
  renderTransactions();

  document.getElementById("txSymbol").value   = "";
  document.getElementById("txQty").value      = "";
  document.getElementById("txPrice").value    = "";
  document.getElementById("txCategory").value = "";
  document.getElementById("txDate").value     = "";
}

function renderTransactions() {
  const table = document.getElementById("transactionTable");
  if (!table) return;
  table.innerHTML = transactions.map(tx => `
    <tr>
      <td><span class="instrument-name">${tx.symbol}</span></td>
      <td>${tx.qty}</td>
      <td style="font-family:var(--font-mono)">$${tx.price}</td>
      <td><span style="font-size:12px;color:var(--muted)">${tx.category || "—"}</span></td>
      <td style="font-size:12px;color:var(--muted)">${tx.date || "—"}</td>
    </tr>`).join("");
}

/* ── DELETE STOCK ── */
async function deleteStock(index) {
  const symbolToDelete = portfolio[index].symbol;
  transactions = transactions.filter(tx => tx.symbol !== symbolToDelete);
  await saveTransactions();

  rebuildPortfolio();
  renderPortfolioTable();
  updateDashboard();
}

/* ── PAGE LOAD HANDLERS ── */
if (window.location.pathname.includes("portfolio.html")) {
  loadTransactions().then(() => updateLivePrices()).then(() => renderPortfolioTable());
}

if (window.location.pathname.includes("home.html")) {
  loadTransactions().then(() => updateLivePrices()).then(() => {
    updateDashboard();
    renderChart();
  });
}

if (window.location.pathname.includes("transactions.html")) {
  loadTransactions().then(() => renderTransactions());
}
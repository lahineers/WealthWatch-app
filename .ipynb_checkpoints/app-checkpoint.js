let portfolio = JSON.parse(localStorage.getItem("portfolio")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

const USERNAME = "admin";
const PASSWORD = "1234";
const API_KEY = "8805673262034430a8368a0ecbb17408";

/* ---------------- LOGIN SYSTEM ---------------- */

function login() {
  const userInput = document.getElementById("username");
  const passInput = document.getElementById("password");

  if (userInput.value === USERNAME && passInput.value === PASSWORD) {
    localStorage.setItem("loggedIn", "true");
    window.location.href = "home.html";
  } else {
    alert("Invalid username or password");
    userInput.value = "";
    passInput.value = "";
    userInput.focus();
  }
}

function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "login.html";
}

/* --------- PAGE PROTECTION --------- */

if (
  (window.location.pathname.includes("home.html") ||
   window.location.pathname.includes("portfolio.html") ||
   window.location.pathname.includes("transactions.html")) &&
  !localStorage.getItem("loggedIn")
) {
  window.location.href = "login.html";
}

/* --------- NAVIGATION --------- */

function showHome() {
  window.location.href = "home.html";
}

function showPortfolio() {
  window.location.href = "portfolio.html";
}

function showTransactions() {
  window.location.href = "transactions.html";
}

/* --------- BUILD PORTFOLIO FROM TRANSACTIONS --------- */

function rebuildPortfolio() {
  portfolio = [];

  transactions.forEach(tx => {
    const existing = portfolio.find(s => s.symbol === tx.symbol);

    if (existing) {
      const totalQty = existing.qty + tx.qty;

      const avgBuy =
        ((existing.qty * existing.buyPrice) +
         (tx.qty * tx.price)) / totalQty;

      existing.qty = totalQty;
      existing.buyPrice = Math.round(avgBuy);
      existing.category = tx.category;
    } else {
      portfolio.push({
        symbol: tx.symbol,
        qty: tx.qty,
        buyPrice: tx.price,
        currentPrice: tx.price,
        category: tx.category
      });
    }
  });

  localStorage.setItem("portfolio", JSON.stringify(portfolio));
}

/* --------- LIVE PRICE (BATCH FETCH) --------- */

async function updateLivePrices() {
  if (portfolio.length === 0) return;

  const symbols = portfolio
    .map(stock => stock.symbol)
    .join(",");

  try {
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${API_KEY}`
    );

    const data = await response.json();
    console.log("QUOTE DATA:", data);

    portfolio.forEach(stock => {
      const apiSymbol = stock.symbol;

      if (data[apiSymbol] && data[apiSymbol].close) {
        stock.currentPrice = Math.round(Number(data[apiSymbol].close));
      } 
      else if (data.close) {
        stock.currentPrice = Math.round(Number(data.close));
      } 
      else {
        stock.currentPrice = stock.buyPrice;
      }
    });

    localStorage.setItem("portfolio", JSON.stringify(portfolio));

  } catch (error) {
    console.log(error);
  }
}




/* --------- PORTFOLIO TABLE --------- */

function renderPortfolioTable() {
  const container = document.getElementById("portfolioTable");
  if (!container) return;

  let totalInvestment = 0;
  let totalCurrent = 0;

  container.innerHTML = portfolio.map((stock, index) => {
    const invested = stock.buyPrice * stock.qty;
    const currentValue = stock.currentPrice * stock.qty;
    const profit = currentValue - invested;

    const returnPercent =
      ((stock.currentPrice - stock.buyPrice) / stock.buyPrice) * 100;

    totalInvestment += invested;
    totalCurrent += currentValue;

    return `
      <tr>
        <td>
          <div class="instrument-name">${stock.symbol}</div>
          <div class="instrument-meta">
            ${stock.qty} shares • Avg. $${stock.buyPrice}
          </div>
          <div class="instrument-meta">${stock.category}</div>
        </td>
        <td>${stock.currentPrice}</td>
        <td>${invested.toFixed(2)}</td>
        <td>${currentValue.toFixed(2)}</td>
        <td class="${profit >= 0 ? "green" : "red"}">${profit.toFixed(2)}</td>
        <td class="${returnPercent >= 0 ? "green" : "red"}">
          ${returnPercent.toFixed(2)}%
        </td>
        <td>
          <button onclick="deleteStock(${index})">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  const totalProfit = totalCurrent - totalInvestment;

  document.getElementById("totalInvestment").innerText =
    "Total Investment: $" + totalInvestment;

  document.getElementById("totalCurrent").innerText =
    "Current Value: $" + totalCurrent;

  const profitElement = document.getElementById("totalProfit");

  if (profitElement) {
    profitElement.innerHTML =
      totalProfit >= 0
        ? "Total Profit: <span class='green'>$" + totalProfit.toFixed(2)+ "</span>"
        : "Total Loss: <span class='red'>$" + Math.abs(totalProfit).toFixed(2) + "</span>";
  }
}

/* --------- DASHBOARD --------- */

function updateDashboard() {
  let totalInvestment = 0;
  let totalCurrent = 0;

  portfolio.forEach(stock => {
    totalInvestment += stock.buyPrice * stock.qty;
    totalCurrent += stock.currentPrice * stock.qty;
  });

  const totalProfit = totalCurrent - totalInvestment;

  const inv = document.getElementById("dashboardInvestment");
  const cur = document.getElementById("dashboardCurrent");
  const prof = document.getElementById("dashboardProfit");

  if (!inv) return;

  inv.innerText = "$" + totalInvestment.toFixed(2);
  cur.innerText = "$" + totalCurrent.toFixed(2);

  prof.innerHTML =
    totalProfit >= 0
      ? `<span class="green">$${totalProfit.toFixed(2)}</span>`
      : `<span class="red">$${Math.abs(totalProfit).toFixed(2)}</span>`;
}

/* --------- TRANSACTIONS --------- */

function addTransaction() {
  const symbol = document.getElementById("txSymbol").value.toUpperCase();
  const qty = Number(document.getElementById("txQty").value);
  const price = Number(document.getElementById("txPrice").value);
  const category = document.getElementById("txCategory").value;

  if (!symbol || !qty || !price || !category) {
    alert("Fill all fields");
    return;
  }

  transactions.push({ symbol, qty, price, category });
  localStorage.setItem("transactions", JSON.stringify(transactions));

  rebuildPortfolio();
  renderTransactions();

  document.getElementById("txSymbol").value = "";
  document.getElementById("txQty").value = "";
  document.getElementById("txPrice").value = "";
  document.getElementById("txCategory").value = "";
}

function renderTransactions() {
  const table = document.getElementById("transactionTable");
  if (!table) return;

  table.innerHTML = transactions.map(tx => `
    <tr>
      <td>${tx.symbol}</td>
      <td>${tx.qty}</td>
      <td>$${tx.price}</td>
    </tr>
  `).join("");
}

/* --------- DELETE STOCK --------- */

function deleteStock(index) {
  const symbolToDelete = portfolio[index].symbol;

  transactions = transactions.filter(
    tx => tx.symbol !== symbolToDelete
  );

  localStorage.setItem("transactions", JSON.stringify(transactions));

  rebuildPortfolio();
  renderPortfolioTable();
  updateDashboard();
}

/* --------- PAGE LOAD HANDLERS --------- */

if (window.location.pathname.includes("portfolio.html")) {
  rebuildPortfolio();
  updateLivePrices().then(() => renderPortfolioTable());
}

if (window.location.pathname.includes("home.html")) {
  rebuildPortfolio();
  updateLivePrices().then(() => updateDashboard());
}

if (window.location.pathname.includes("transactions.html")) {
  renderTransactions();
}

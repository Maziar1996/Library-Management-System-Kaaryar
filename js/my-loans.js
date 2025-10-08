document.addEventListener("DOMContentLoaded", async function () {
  function getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }

  async function makeAuthenticatedRequest(endpoint, options = {}) {
    const token = getCookie("jwtToken");
    if (!token) {
      window.location.href = "login.html";
      return null;
    }

    const baseUrl = "https://karyar-library-management-system.liara.run/api";
    let url = `${baseUrl}${endpoint}`;

    if (options.pathParams) {
      Object.keys(options.pathParams).forEach((key) => {
        url = url.replace(`:${key}`, options.pathParams[key]);
      });
    }

    const defaultOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...options,
    };

    if (options.body) {
      defaultOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, defaultOptions);
      let data = null;
      try {
        data = await response.json();
      } catch {}

      if (!response.ok) {
        if (response.status === 401) {
          setCookie("jwtToken", "", -1);
          window.location.href = "login.html";
        }
        throw new Error(
          data?.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  const token = getCookie("jwtToken");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const studentNameElements = document.querySelectorAll(".student-name");
  const userAvatar = document.querySelector(".user-avatar");
  const loansTableBody = document.querySelector(".table tbody");
  const totalLoansElement = document.querySelector(".total-loans");
  const activeLoansElement = document.querySelector(
    ".stat-card:nth-child(1) .stat-number"
  );
  const returnedBooksElement = document.querySelector(
    ".stat-card:nth-child(2) .stat-number"
  );
  const logoutLink = document.querySelector('.nav a[href="logout"]');

  let errorMessage = document.querySelector(".error-message");
  if (!errorMessage) {
    errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
    errorMessage.style.color = "red";
    errorMessage.style.marginTop = "10px";
    errorMessage.style.textAlign = "center";
    errorMessage.style.display = "none";
    document.querySelector(".main-content").prepend(errorMessage);
  }

  if (logoutLink) {
    logoutLink.addEventListener("click", function (event) {
      event.preventDefault();
      setCookie("jwtToken", "", -1);
      window.location.href = "login.html";
    });
  }

  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toISOString().split("T")[0];
    } catch {
      return "N/A";
    }
  }

  async function renderLoans(loans, showActiveOnly = false) {
    loansTableBody.innerHTML = "";
    let filteredLoans = loans;
    if (showActiveOnly) {
      filteredLoans = loans.filter((loan) => loan.status === "active");
    }

    if (!filteredLoans || filteredLoans.length === 0) {
      loansTableBody.innerHTML =
        '<tr><td colspan="5">No loans found.</td></tr>';
      totalLoansElement.textContent = loans.length;
      activeLoansElement.textContent = "0";
      returnedBooksElement.textContent = loans.length;
      return;
    }

    const activeLoans = loans.filter((loan) => loan.status === "active").length;
    const returnedLoans = loans.filter(
      (loan) => loan.status === "returned"
    ).length;
    totalLoansElement.textContent = loans.length;
    activeLoansElement.textContent = activeLoans;
    returnedBooksElement.textContent = returnedLoans;

    for (const loan of filteredLoans) {
      const book = loan.book || {};
      const bookId = book.id || "Unknown";
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${book.title || `Book ID: ${bookId}`}</td>
                <td>${book.author || "Unknown"}</td>
                <td>${formatDate(loan.loanDate)}</td>
                <td>${loan.status === "active" ? "Active" : "Returned"}</td>
                <td>
                    ${
                      loan.status === "active"
                        ? `<button class="btn btn-primary return-btn" data-loan-id="${loan.id}">Return</button>`
                        : ""
                    }
                </td>
            `;
      loansTableBody.appendChild(row);
    }

    document.querySelectorAll(".return-btn").forEach((button) => {
      button.addEventListener("click", async function () {
        const loanId = button.getAttribute("data-loan-id");
        try {
          const result = await makeAuthenticatedRequest(
            `/loans/${loanId}/return`,
            {
              method: "POST",
              pathParams: { id: loanId },
              body: {},
            }
          );

          errorMessage.innerHTML = "Book returned successfully!";
          errorMessage.style.color = "green";
          errorMessage.style.display = "block";
          setTimeout(() => {
            errorMessage.style.display = "none";
          }, 3000);
          await loadLoans();
        } catch (error) {
          errorMessage.innerHTML =
            error.message || "Failed to return book. Please try again later.";
          errorMessage.style.color = "red";
          errorMessage.style.display = "block";
          setTimeout(() => {
            errorMessage.style.display = "none";
          }, 5000);
        }
      });
    });
  }

  async function loadUserProfile() {
    try {
      const data = await makeAuthenticatedRequest("/auth/me");
      if (data && data.success && data.data && data.data.user) {
        const user = data.data.user;
        const fullName =
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || "User";

        studentNameElements.forEach((element) => {
          element.textContent = fullName;
        });
        if (userAvatar) {
          const initial =
            user.firstName?.charAt(0) || user.lastName?.charAt(0) || "U";
          userAvatar.textContent = initial.toUpperCase();
        }
      } else {
        studentNameElements.forEach((element) => {
          element.textContent = "User";
        });
        if (userAvatar) userAvatar.textContent = "U";
      }
    } catch (error) {
      errorMessage.innerHTML = "Failed to load user profile. Please try again.";
      errorMessage.style.display = "block";
      setTimeout(() => {
        errorMessage.style.display = "none";
      }, 5000);
    }
  }

  async function loadLoans() {
    try {
      const response = await makeAuthenticatedRequest("/loans/my-loans");
      if (response && response.success && Array.isArray(response.data)) {
        await renderLoans(response.data, false);
      } else {
        loansTableBody.innerHTML =
          '<tr><td colspan="5">No loans found.</td></tr>';
        totalLoansElement.textContent = "0";
        activeLoansElement.textContent = "0";
        returnedBooksElement.textContent = "0";
      }
    } catch (error) {
      errorMessage.innerHTML = "Failed to load loans. Please try again.";
      errorMessage.style.display = "block";
      setTimeout(() => {
        errorMessage.style.display = "none";
      }, 5000);
    }
  }

  try {
    await Promise.all([loadUserProfile(), loadLoans()]);
  } catch (error) {}
});

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
      console.error("No JWT token found. Redirecting to login.");
      window.location.href = "/login.html";
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
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setCookie("jwtToken", "", -1);
          window.location.href = "/login.html";
        }
        throw new Error(
          data.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  const token = getCookie("jwtToken");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const studentNameElements = document.querySelectorAll(".student-name");
  const welcomeMessage = document.querySelector(".welcome-message");
  const statNumbers = document.querySelectorAll(".stat-number");
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

      window.location.href = "/login.html";
    });
  }

  async function loadDashboardData() {
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
        if (welcomeMessage) {
          welcomeMessage.textContent = `Welcome back, ${fullName}!`;
        }

        // Display stats
        if (data.data.stats) {
          statNumbers[0].textContent = data.data.stats.activeLoans || 0;
          statNumbers[1].textContent = data.data.stats.availableBooks || 0;
        } else {
          statNumbers[0].textContent = 0;
          statNumbers[1].textContent = 0;
          console.warn("No stats found in response");
        }
      } else {
        studentNameElements.forEach((element) => {
          element.textContent = "User";
        });
        if (welcomeMessage) {
          welcomeMessage.textContent = "Welcome back, User!";
        }
        statNumbers[0].textContent = 0;
        statNumbers[1].textContent = 0;
        console.warn("Invalid response structure");
      }
    } catch (error) {
      errorMessage.innerHTML =
        "Failed to load dashboard data. Please try again.";
      errorMessage.style.display = "block";
      console.error("Dashboard error:", error);
    }
  }

  try {
    await loadDashboardData();
  } catch (error) {
    console.error("Error in data loading:", error);
  }
});

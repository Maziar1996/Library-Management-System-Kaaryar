document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.querySelector("form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginSection = document.querySelector(".login-card");

  let errorMessage = document.querySelector(".error-message");
  if (!errorMessage) {
    errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
    errorMessage.style.color = "red";
    errorMessage.style.marginTop = "10px";
    errorMessage.style.display = "none";
    loginSection.insertBefore(errorMessage, loginForm);
  }

  function validateInputs() {
    let isValid = true;
    let errorText = "";

    const email = emailInput.value.trim();
    if (!email) {
      isValid = false;
      errorText += "Email is required.<br>";
    } else if (!email.includes("@") || !email.includes(".")) {
      isValid = false;
      errorText +=
        "Please enter a valid email address (must include @ and .).<br>";
    }

    if (!passwordInput.value.trim()) {
      isValid = false;
      errorText += "Password is required.<br>";
    }

    errorMessage.innerHTML = errorText;
    errorMessage.style.display = isValid ? "none" : "block";

    return isValid;
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

  async function makeAuthenticatedRequest(endpoint, options = {}) {
    const token = getCookie("jwtToken");
    if (!token && endpoint !== "/auth/login") {
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
      },
      ...options,
    };

    if (token && endpoint !== "/auth/login") {
      defaultOptions.headers.Authorization = `Bearer ${token}`;
    }

    if (options.body) {
      defaultOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, defaultOptions);
      const data = await response.json();

      if (!response.ok) {
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

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!validateInputs()) {
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      try {
        const data = await makeAuthenticatedRequest("/auth/login", {
          method: "POST",
          body: { email, password },
        });

        if (data && data.token) {
          setCookie("jwtToken", data.token, 7);
          window.location.href = "dashboard.html";
        } else {
          errorMessage.innerHTML =
            data?.message || "Invalid email or password.";
          errorMessage.style.display = "block";
        }
      } catch (error) {
        errorMessage.innerHTML = "Login failed. Please try again.";
        errorMessage.style.display = "block";
        console.error("Login error:", error);
      }
    });
  }
});

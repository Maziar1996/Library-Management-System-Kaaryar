let userId = null;

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
      let data = null;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.warn("Failed to parse JSON response:", jsonError);
      }

      if (!response.ok) {
        if (response.status === 401) {
          setCookie("jwtToken", "", -1);
          window.location.href = "/login.html";
        }
        throw new Error(
          data?.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  const token = getCookie("jwtToken");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const studentNameElements = document.querySelectorAll(".student-name");
  const bookList = document.querySelector(".book-list");
  const searchInput = document.querySelector(".search-input");
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

  function getCachedBooks() {
    const cached = localStorage.getItem("booksCache");
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const cacheDuration = 5 * 60 * 1000;
      if (now - timestamp < cacheDuration) {
        return data;
      } else {
        localStorage.removeItem("booksCache");
      }
    }
    return null;
  }

  function cacheBooks(books) {
    const cacheData = {
      data: books,
      timestamp: Date.now(),
    };
    localStorage.setItem("booksCache", JSON.stringify(cacheData));
  }

  function renderBooks(books) {
    bookList.innerHTML = "";
    if (!books || books.length === 0) {
      bookList.innerHTML = "<p>No books found.</p>";
      return;
    }

    books.forEach((book) => {
      const bookCard = document.createElement("div");
      bookCard.className = "book-card";
      bookCard.innerHTML = `
                <h3>${book.title || "Untitled"}</h3>
                <p><strong>Author:</strong> ${book.author || "Unknown"}</p>
                <p><strong>ISBN:</strong> ${book.isbn || "N/A"}</p>
                <p><strong>Category:</strong> ${
                  book.category?.name || "N/A"
                }</p>
                <p><strong>Available Copies:</strong> ${
                  book.availableCopies || 0
                }</p>
                <button class="btn btn-primary borrow-btn" data-book-id="${
                  book.id
                }" 
                    ${book.availableCopies > 0 ? "" : "disabled"}>${
        book.availableCopies > 0 ? "Borrow" : "Unavailable"
      }</button>
            `;
      bookList.appendChild(bookCard);
    });

    document.querySelectorAll(".borrow-btn").forEach((button) => {
      button.addEventListener("click", async function () {
        const bookId = button.getAttribute("data-book-id");
        const book = allBooks.find((book) => book.id === bookId);
        if (!book || book.availableCopies <= 0) {
          errorMessage.innerHTML = "Book is not available for borrowing.";
          errorMessage.style.color = "red";
          errorMessage.style.display = "block";
          return;
        }
        if (!userId) {
          errorMessage.innerHTML =
            "Cannot borrow book. User profile not loaded.";
          errorMessage.style.color = "red";
          errorMessage.style.display = "block";
          return;
        }

        try {
          const result = await makeAuthenticatedRequest("/loans", {
            method: "POST",
            body: { bookId, userId },
          });

          errorMessage.innerHTML = "Book borrowed successfully!";
          errorMessage.style.color = "green";
          errorMessage.style.display = "block";
          setTimeout(() => {
            errorMessage.style.display = "none";
          }, 3000);

          localStorage.removeItem("booksCache");
          await loadBooks();
        } catch (error) {
          errorMessage.innerHTML = error.message.includes(
            "Please check your input data"
          )
            ? "Cannot borrow book. Please ensure the book is available and your account is valid."
            : error.message || "Failed to borrow book. Please try again later.";
          errorMessage.style.color = "red";
          errorMessage.style.display = "block";
        }
      });
    });
  }

  let allBooks = [];
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const searchTerm = searchInput.value.trim().toLowerCase();
      const filteredBooks = allBooks.filter(
        (book) => book.title && book.title.toLowerCase().includes(searchTerm)
      );
      renderBooks(filteredBooks);
    });
  }

  async function loadUserProfile() {
    try {
      const data = await makeAuthenticatedRequest("/auth/me");
      if (data && data.success && data.data && data.data.user) {
        const user = data.data.user;

        userId = user.id || user._id || user.studentId || user.userId || null;
        const fullName =
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || "User";

        studentNameElements.forEach((element) => {
          element.textContent = fullName;
        });
      } else {
        studentNameElements.forEach((element) => {
          element.textContent = "User";
        });
      }
    } catch (error) {
      errorMessage.innerHTML = "Failed to load user profile. Please try again.";
      errorMessage.style.display = "block";
      console.error("Profile error:", error.message);
    }
  }

  async function loadBooks() {
    try {
      const cachedBooks = getCachedBooks();
      if (cachedBooks) {
        allBooks = cachedBooks;
        renderBooks(cachedBooks);
        return;
      }

      const response = await makeAuthenticatedRequest("/books");
      if (response && response.success && Array.isArray(response.data)) {
        allBooks = response.data;
        cacheBooks(response.data);
        renderBooks(response.data);
      } else {
        bookList.innerHTML = "<p>No books found.</p>";
      }
    } catch (error) {
      errorMessage.innerHTML = "Failed to load books. Please try again.";
      errorMessage.style.display = "block";
      console.error("Books error:", error.message);
    }
  }

  try {
    await Promise.all([loadUserProfile(), loadBooks()]);
  } catch (error) {
    console.error("Error in data loading:", error.message);
  }
});

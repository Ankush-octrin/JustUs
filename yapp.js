import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// 1. Firebase configuration

const firebaseConfig = {
    apiKey: "AIzaSyAnLGitT1kVwmpHwJ0SYeX2lhrmd8o2Kho",
    authDomain: "justus-abeca.firebaseapp.com",
    projectId: "justus-abeca",
    storageBucket: "justus-abeca.firebasestorage.app",
    messagingSenderId: "563145164463",
    appId: "1:563145164463:web:5c00dde813eb24d975f65a",
    measurementId: "G-T15LXHFYFE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// 2. Only these two email addresses can access JustUs.
// Replace both placeholders before testing.

const OWNER_EMAIL = "ankush2r@gmail.com".toLowerCase(); // my email
const FRIEND_EMAIL = "ankush80838@gmail.com".toLowerCase(); // friend's email

const ALLOWED_EMAILS = [
    OWNER_EMAIL,
    FRIEND_EMAIL
];

const CHAT_ID = "justus-private-chat";

const messagesCollection = collection(
    db,
    "chats",
    CHAT_ID,
    "messages"
);


// 3. HTML elements

const authScreen = document.getElementById("authScreen");
const messenger = document.getElementById("messenger");

const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const nameField = document.getElementById("nameField");
const displayNameInput = document.getElementById("displayName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const forgotPassword = document.getElementById("forgotPassword");
const resendVerification = document.getElementById("resendVerification");

const logoutButton = document.getElementById("logoutButton");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messagesContainer = document.getElementById("messages");
const chatStatus = document.getElementById("chatStatus");


// 4. State

let isRegisterMode = false;
let currentUser = null;
let messagesUnsubscribe = null;
let isSendingMessage = false;
let pendingVerificationUser = null;
let authRequestInProgress = false;


// 5. Helpers

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function isAllowedEmail(email) {
    return ALLOWED_EMAILS.includes(normalizeEmail(email));
}

function showMessage(text, type = "") {
    authMessage.textContent = text;
    authMessage.className = "status-message";

    if (type) {
        authMessage.classList.add(type);
    }
}

function showLoginScreen() {
    authScreen.classList.remove("hidden");
    messenger.classList.add("hidden");
}

function showMessengerScreen() {
    authScreen.classList.add("hidden");
    messenger.classList.remove("hidden");
}

function stopListeningForMessages() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}

function setAuthLoading(loading) {
    authRequestInProgress = loading;
    authSubmit.disabled = loading;
    authSubmit.textContent = loading
        ? "Please wait..."
        : (isRegisterMode ? "Create account" : "Log in");
}

function friendlyAuthError(error) {
    const errors = {
        "auth/email-already-in-use":
            "An account already exists with this email. Try logging in.",
        "auth/invalid-email":
            "Please enter a valid email address.",
        "auth/weak-password":
            "Choose a stronger password with at least 6 characters.",
        "auth/user-not-found":
            "No account was found with this email. Create an account first.",
        "auth/wrong-password":
            "Incorrect email or password.",
        "auth/invalid-credential":
            "Incorrect email or password.",
        "auth/too-many-requests":
            "Too many attempts. Please wait and try again.",
        "auth/network-request-failed":
            "Network error. Check your internet connection.",
        "auth/operation-not-allowed":
            "Enable Email/Password in Firebase Authentication.",
        "auth/unauthorized-domain":
            "Add your website domain to Firebase Authorized domains."
    };

    return errors[error.code] ||
        error.message ||
        "Something went wrong. Please try again.";
}


// 6. Switch between login and registration

function setMode(register) {
    isRegisterMode = register;

    loginTab.classList.toggle("active", !register);
    registerTab.classList.toggle("active", register);

    nameField.classList.toggle("hidden", !register);
    displayNameInput.required = register;

    forgotPassword.classList.toggle("hidden", register);
    resendVerification.classList.add("hidden");

    authSubmit.textContent = register
        ? "Create account"
        : "Log in";

    showMessage("");
}

loginTab.addEventListener("click", () => setMode(false));
registerTab.addEventListener("click", () => setMode(true));


// 7. Register or log in

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (authRequestInProgress) return;

    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;
    const displayName = displayNameInput.value.trim();

    if (!isAllowedEmail(email)) {
        showMessage(
            "This email is not on the JustUs access list.",
            "error"
        );
        return;
    }

    if (isRegisterMode && !displayName) {
        showMessage("Enter your name.", "error");
        return;
    }

    if (password.length < 6) {
        showMessage(
            "Your password must contain at least 6 characters.",
            "error"
        );
        return;
    }

    setAuthLoading(true);

    try {
        if (isRegisterMode) {
            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            // Send a verification email.
            await sendEmailVerification(result.user);

            // Save the account name in local display metadata.
            // Firestore security rules remain the actual access control.
            await signOut(auth);

            setMode(false);
            emailInput.value = email;
            passwordInput.value = "";

            showMessage(
                "Account created! Open the verification link sent to your email, then log in.",
                "success"
            );

        } else {
            const result = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            await result.user.reload();

            const user = auth.currentUser;

            if (!user || !isAllowedEmail(user.email)) {
                await signOut(auth);
                showMessage(
                    "This account is not authorized for JustUs.",
                    "error"
                );
                return;
            }

            if (!user.emailVerified) {
                pendingVerificationUser = user;
                await signOut(auth);

                resendVerification.classList.remove("hidden");

                showMessage(
                    "Please verify your email first. Check your inbox and spam folder.",
                    "error"
                );
            }
        }

    } catch (error) {
        console.error("Authentication error:", error);
        showMessage(friendlyAuthError(error), "error");

    } finally {
        setAuthLoading(false);
    }
});


// 8. Resend email verification

resendVerification.addEventListener("click", async () => {
    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;

    if (!isAllowedEmail(email)) {
        showMessage("This email is not authorized.", "error");
        return;
    }

    if (!password) {
        showMessage(
            "Enter your password and log in to request verification again.",
            "error"
        );
        return;
    }

    resendVerification.disabled = true;

    try {
        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        if (result.user.emailVerified) {
            await signOut(auth);
            showMessage(
                "Your email is already verified. You can log in.",
                "success"
            );
            resendVerification.classList.add("hidden");
            return;
        }

        await sendEmailVerification(result.user);
        await signOut(auth);

        showMessage(
            "A new verification email has been sent.",
            "success"
        );

    } catch (error) {
        showMessage(friendlyAuthError(error), "error");

    } finally {
        resendVerification.disabled = false;
    }
});


// 9. Forgot password

forgotPassword.addEventListener("click", async () => {
    const email = normalizeEmail(emailInput.value);

    if (!email) {
        showMessage(
            "Enter your email address first.",
            "error"
        );
        return;
    }

    if (!isAllowedEmail(email)) {
        showMessage(
            "This email is not authorized for JustUs.",
            "error"
        );
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);

        showMessage(
            "If an account exists for this address, a password reset email has been requested.",
            "success"
        );

    } catch (error) {
        showMessage(friendlyAuthError(error), "error");
    }
});


// 10. Authentication state and access control

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;
        stopListeningForMessages();
        showLoginScreen();
        return;
    }

    if (!isAllowedEmail(user.email)) {
        await signOut(auth);
        showLoginScreen();
        showMessage(
            "This account is not authorized for JustUs.",
            "error"
        );
        return;
    }

    if (!user.emailVerified) {
        await signOut(auth);
        showLoginScreen();
        showMessage(
            "Verify your email before accessing JustUs.",
            "error"
        );
        return;
    }

    currentUser = user;

    chatStatus.textContent = `Signed in as ${user.email}`;

    showMessengerScreen();
    startListeningForMessages();
});


// 11. Real-time message listener

function startListeningForMessages() {
    stopListeningForMessages();

    messagesContainer.replaceChildren();

    const messageQuery = query(
        messagesCollection,
        orderBy("createdAt", "asc")
    );

    messagesUnsubscribe = onSnapshot(
        messageQuery,
        (snapshot) => {
            messagesContainer.replaceChildren();

            if (snapshot.empty) {
                const empty = document.createElement("div");
                empty.className = "empty-state";

                const heart = document.createElement("div");
                heart.className = "empty-heart";
                heart.textContent = "♡";

                const heading = document.createElement("h3");
                heading.textContent = "A space for just us";

                const paragraph = document.createElement("p");
                paragraph.textContent =
                    "Send the first message and start your conversation.";

                empty.append(heart, heading, paragraph);
                messagesContainer.appendChild(empty);
                return;
            }

            snapshot.forEach((documentSnapshot) => {
                renderMessage(documentSnapshot.data());
            });

            messagesContainer.scrollTop =
                messagesContainer.scrollHeight;
        },
        (error) => {
            console.error("Firestore listener error:", error);

            showMessage(
                "Unable to load messages. Check your Firestore security rules.",
                "error"
            );
        }
    );
}


// 12. Render a message safely

function renderMessage(message) {
    if (!currentUser) return;

    const isOwnMessage = message.senderId === currentUser.uid;

    const row = document.createElement("div");
    row.className = isOwnMessage
        ? "message-row own"
        : "message-row";

    const sender = document.createElement("div");
    sender.className = "message-sender";
    sender.textContent = isOwnMessage
        ? "You"
        : (message.senderName || "Friend");

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text || "";

    const time = document.createElement("div");
    time.className = "message-time";

    if (message.createdAt) {
        time.textContent = message.createdAt.toDate().toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
        );
    } else {
        time.textContent = "Sending...";
    }

    row.append(sender, bubble, time);
    messagesContainer.appendChild(row);
}


// 13. Send a message

messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || isSendingMessage) return;

    if (!isAllowedEmail(currentUser.email) ||
        !currentUser.emailVerified) {
        showMessage("Your account is not authorized.", "error");
        return;
    }

    const text = messageInput.value.trim();

    if (!text || text.length > 4000) return;

    isSendingMessage = true;
    sendButton.disabled = true;

    try {
        await addDoc(messagesCollection, {
            senderId: currentUser.uid,
            senderEmail: currentUser.email,
            senderName: currentUser.displayName || currentUser.email,
            text,
            createdAt: serverTimestamp()
        });

        messageInput.value = "";
        messageInput.focus();

    } catch (error) {
        console.error("Send message error:", error);

        showMessage(
            "Message could not be sent. Check your internet connection and Firestore rules.",
            "error"
        );

    } finally {
        isSendingMessage = false;
        sendButton.disabled = false;
    }
});


// 14. Logout

logoutButton.addEventListener("click", async () => {
    stopListeningForMessages();

    try {
        await signOut(auth);
        passwordInput.value = "";
        showMessage("You have logged out.", "success");

    } catch (error) {
        showMessage(friendlyAuthError(error), "error");
    }
});
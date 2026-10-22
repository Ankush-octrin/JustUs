import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    signOut
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


// --------------------------------------------------
// 1. FIREBASE CONFIGURATION
// --------------------------------------------------

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


// --------------------------------------------------
// 2. AUTHORIZED PHONE NUMBERS
// --------------------------------------------------

const OWNER_PHONE = "+917909097469";
const FRIEND_PHONE = "+919507963553";

const AUTHORIZED_PHONES = [
    OWNER_PHONE,
    FRIEND_PHONE
];

const CHAT_ID = "justus-private-chat";

const messagesCollection = collection(
    db,
    "chats",
    CHAT_ID,
    "messages"
);


// --------------------------------------------------
// 3. HTML ELEMENTS
// --------------------------------------------------

const authScreen = document.getElementById("authScreen");
const messenger = document.getElementById("messenger");

const phoneNumberInput =
    document.getElementById("phoneNumber");

const otpCodeInput =
    document.getElementById("otpCode");

const sendOtpButton =
    document.getElementById("sendOtpButton");

const verifyOtpButton =
    document.getElementById("verifyOtpButton");

const changeNumberButton =
    document.getElementById("changeNumberButton");

const phoneSection =
    document.getElementById("phoneSection");

const otpSection =
    document.getElementById("otpSection");

const authMessage =
    document.getElementById("authMessage");

const logoutButton =
    document.getElementById("logoutButton");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const messagesContainer =
    document.getElementById("messages");

const chatName =
    document.getElementById("chatName");

const chatStatus =
    document.getElementById("chatStatus");


// --------------------------------------------------
// 4. APPLICATION STATE
// --------------------------------------------------

let confirmationResult = null;
let recaptchaVerifier = null;
let messagesUnsubscribe = null;
let currentUser = null;
let isSendingMessage = false;
let isSigningOutUnauthorizedUser = false;


// --------------------------------------------------
// 5. HELPER FUNCTIONS
// --------------------------------------------------

function isAuthorizedPhone(phone) {
    return AUTHORIZED_PHONES.includes(phone);
}


function showAuthMessage(message, type = "") {
    authMessage.textContent = message;

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


function setButtonLoading(button, loading, originalText) {
    button.disabled = loading;

    button.textContent = loading
        ? "Please wait..."
        : originalText;
}


function getDisplayName(phone) {
    return phone === OWNER_PHONE ? "You" : "Her";
}


function clearMessages() {
    messagesContainer.replaceChildren();
}


function stopListeningForMessages() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}


// --------------------------------------------------
// 6. RECAPTCHA
// --------------------------------------------------

function resetRecaptcha() {
    if (recaptchaVerifier) {
        try {
            recaptchaVerifier.clear();
        } catch (error) {
            console.warn(
                "Could not clear reCAPTCHA:",
                error
            );
        }

        recaptchaVerifier = null;
    }

    document.getElementById(
        "recaptcha-container"
    ).replaceChildren();
}


function createRecaptcha() {
    resetRecaptcha();

    recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
            size: "normal",

            callback: () => {
                showAuthMessage(
                    "Verification completed. You can continue.",
                    "success"
                );
            },

            "expired-callback": () => {
                showAuthMessage(
                    "Verification expired. Please try again.",
                    "error"
                );
            }
        }
    );

    return recaptchaVerifier;
}


// --------------------------------------------------
// 7. SEND OTP
// --------------------------------------------------

sendOtpButton.addEventListener("click", async () => {

    const phone = phoneNumberInput.value.trim();

    if (!phone) {
        showAuthMessage(
            "Please enter your phone number.",
            "error"
        );
        return;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        showAuthMessage(
            "Enter a valid number with country code, such as +91XXXXXXXXXX.",
            "error"
        );
        return;
    }

    if (!isAuthorizedPhone(phone)) {
        showAuthMessage(
            "This phone number is not authorized to access JustUs.",
            "error"
        );
        return;
    }

    setButtonLoading(
        sendOtpButton,
        true,
        "Send verification code"
    );

    try {
        showAuthMessage(
            "Preparing phone verification..."
        );

        const verifier = createRecaptcha();

        await verifier.render();

        confirmationResult = await signInWithPhoneNumber(
            auth,
            phone,
            verifier
        );

        phoneSection.classList.add("hidden");
        otpSection.classList.remove("hidden");

        showAuthMessage(
            "Verification code sent. Check your SMS messages.",
            "success"
        );

        otpCodeInput.focus();

    } catch (error) {

        console.error("OTP sending failed:", error);

        resetRecaptcha();

        let message =
            "Could not send the verification code. Please try again.";

        if (error.code === "auth/invalid-phone-number") {
            message = "The phone number is invalid.";
        } else if (
            error.code === "auth/too-many-requests"
        ) {
            message =
                "Too many attempts. Please wait before trying again.";
        } else if (
            error.code === "auth/quota-exceeded"
        ) {
            message =
                "The SMS quota has been exceeded. Check Firebase settings.";
        } else if (
            error.code === "auth/operation-not-allowed"
        ) {
            message =
                "Phone authentication is not enabled in Firebase.";
        } else if (
            error.code === "auth/unauthorized-domain"
        ) {
            message =
                "This website domain is not authorized in Firebase.";
        } else if (
            error.code === "auth/captcha-check-failed"
        ) {
            message =
                "reCAPTCHA verification failed. Please try again.";
        } else if (
            error.code === "auth/billing-not-enabled"
        ) {
            message =
                "Firebase requires billing configuration for this operation.";
        }

        showAuthMessage(message, "error");

    } finally {

        setButtonLoading(
            sendOtpButton,
            false,
            "Send verification code"
        );
    }
});


// --------------------------------------------------
// 8. VERIFY OTP
// --------------------------------------------------

verifyOtpButton.addEventListener(
    "click",
    async () => {

        const code = otpCodeInput.value.trim();

        if (!confirmationResult) {
            showAuthMessage(
                "Request a verification code first.",
                "error"
            );
            return;
        }

        if (!/^\d{6}$/.test(code)) {
            showAuthMessage(
                "Enter the six-digit verification code.",
                "error"
            );
            return;
        }

        setButtonLoading(
            verifyOtpButton,
            true,
            "Verify and enter chat"
        );

        try {

            const result =
                await confirmationResult.confirm(code);

            const user = result.user;

            if (!isAuthorizedPhone(user.phoneNumber)) {

                await signOut(auth);

                showAuthMessage(
                    "This account is not authorized for JustUs.",
                    "error"
                );

                return;
            }

            showAuthMessage(
                "Verification successful!",
                "success"
            );

            confirmationResult = null;

            resetRecaptcha();

        } catch (error) {

            console.error(
                "OTP verification failed:",
                error
            );

            let message =
                "Verification failed. Please check the code and try again.";

            if (
                error.code === "auth/invalid-verification-code"
            ) {
                message =
                    "Incorrect verification code. Try again.";
            } else if (
                error.code === "auth/code-expired"
            ) {
                message =
                    "The code has expired. Request a new one.";
            } else if (
                error.code === "auth/session-expired"
            ) {
                message =
                    "Your verification session expired. Request a new code.";
            }

            showAuthMessage(message, "error");

        } finally {

            setButtonLoading(
                verifyOtpButton,
                false,
                "Verify and enter chat"
            );
        }
    }
);


// --------------------------------------------------
// 9. CHANGE PHONE NUMBER
// --------------------------------------------------

changeNumberButton.addEventListener("click", () => {

    confirmationResult = null;

    otpCodeInput.value = "";

    otpSection.classList.add("hidden");
    phoneSection.classList.remove("hidden");

    resetRecaptcha();

    showAuthMessage(
        "Enter your phone number to start again."
    );
});


// --------------------------------------------------
// 10. AUTHENTICATION STATE
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {

    currentUser = user;

    if (!user) {

        stopListeningForMessages();

        currentUser = null;

        showLoginScreen();

        return;
    }

    if (!isAuthorizedPhone(user.phoneNumber)) {

        stopListeningForMessages();

        currentUser = null;

        showLoginScreen();

        if (!isSigningOutUnauthorizedUser) {

            isSigningOutUnauthorizedUser = true;

            try {
                await signOut(auth);
            } catch (error) {
                console.error(
                    "Unauthorized logout failed:",
                    error
                );
            } finally {
                isSigningOutUnauthorizedUser = false;
            }
        }

        showAuthMessage(
            "This account is not authorized to use JustUs.",
            "error"
        );

        return;
    }

    showMessengerScreen();

    chatName.textContent = "Just Us";

    chatStatus.textContent =
        `Signed in as ${getDisplayName(user.phoneNumber)}`;

    startListeningForMessages();
});


// --------------------------------------------------
// 11. REAL-TIME MESSAGES
// --------------------------------------------------

function startListeningForMessages() {

    stopListeningForMessages();

    clearMessages();

    const messageQuery = query(
        messagesCollection,
        orderBy("createdAt", "asc")
    );

    messagesUnsubscribe = onSnapshot(
        messageQuery,

        (snapshot) => {

            clearMessages();

            if (snapshot.empty) {

                const emptyState =
                    document.createElement("div");

                emptyState.className = "empty-state";

                const heart =
                    document.createElement("div");

                heart.className = "empty-heart";
                heart.textContent = "♡";

                const heading =
                    document.createElement("h3");

                heading.textContent =
                    "A space for just us";

                const description =
                    document.createElement("p");

                description.textContent =
                    "Send the first message and start your conversation.";

                emptyState.append(
                    heart,
                    heading,
                    description
                );

                messagesContainer.appendChild(emptyState);

                return;
            }

            snapshot.forEach((documentSnapshot) => {

                const message = documentSnapshot.data();

                renderMessage(message);
            });

            messagesContainer.scrollTop =
                messagesContainer.scrollHeight;
        },

        (error) => {

            console.error(
                "Message listener failed:",
                error
            );

            showAuthMessage(
                "Unable to load messages. Check Firestore configuration and security rules.",
                "error"
            );
        }
    );
}


// --------------------------------------------------
// 12. RENDER MESSAGE
// --------------------------------------------------

function renderMessage(message) {

    if (!currentUser) {
        return;
    }

    const isOwnMessage =
        message.senderId === currentUser.uid;

    const row = document.createElement("div");

    row.className = isOwnMessage
        ? "message-row own"
        : "message-row";

    const sender =
        document.createElement("div");

    sender.className = "message-sender";

    sender.textContent =
        isOwnMessage
            ? "You"
            : getDisplayName(message.senderPhone);

    const bubble =
        document.createElement("div");

    bubble.className = "message-bubble";

    // textContent prevents message text from being
    // interpreted as HTML or executable JavaScript.
    bubble.textContent = message.text;

    const time =
        document.createElement("div");

    time.className = "message-time";

    if (message.createdAt) {

        const date = message.createdAt.toDate();

        time.textContent = date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } else {

        time.textContent = "Sending...";
    }

    row.append(sender, bubble, time);

    messagesContainer.appendChild(row);
}


// --------------------------------------------------
// 13. SEND MESSAGE
// --------------------------------------------------

messageForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        if (!currentUser) {
            showAuthMessage(
                "Please sign in before sending messages.",
                "error"
            );
            return;
        }

        if (!isAuthorizedPhone(currentUser.phoneNumber)) {
            showAuthMessage(
                "This account is not authorized.",
                "error"
            );
            return;
        }

        if (isSendingMessage) {
            return;
        }

        const text = messageInput.value.trim();

        if (!text) {
            return;
        }

        if (text.length > 4000) {
            showAuthMessage(
                "Messages cannot exceed 4,000 characters.",
                "error"
            );
            return;
        }

        isSendingMessage = true;

        sendButton.disabled = true;

        try {

            await addDoc(messagesCollection, {
                senderId: currentUser.uid,
                senderPhone: currentUser.phoneNumber,
                text: text,
                createdAt: serverTimestamp()
            });

            messageInput.value = "";

            messageInput.focus();

        } catch (error) {

            console.error(
                "Message sending failed:",
                error
            );

            showAuthMessage(
                "Message could not be sent. Check your internet connection and Firestore rules.",
                "error"
            );

        } finally {

            isSendingMessage = false;

            sendButton.disabled = false;
        }
    }
);


// --------------------------------------------------
// 14. LOGOUT
// --------------------------------------------------

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            stopListeningForMessages();

            await signOut(auth);

            confirmationResult = null;

            otpCodeInput.value = "";
            phoneNumberInput.value = "";

            phoneSection.classList.remove("hidden");
            otpSection.classList.add("hidden");

            resetRecaptcha();

            showAuthMessage(
                "You have logged out successfully.",
                "success"
            );

        } catch (error) {

            console.error("Logout failed:", error);

            showAuthMessage(
                "Unable to log out. Please try again.",
                "error"
            );
        }
    }
);
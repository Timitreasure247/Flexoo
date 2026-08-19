@tailwind base;
@tailwind components;
@tailwind utilities;

/* ========================================
   FLEXOOO - CLEAN BANKING UI
   ======================================== */

:root {
  --background: 150 45% 4%;
  --foreground: 0 0% 96%;

  --card: 150 35% 7%;
  --card-foreground: 0 0% 96%;

  --popover: 150 35% 7%;
  --popover-foreground: 0 0% 96%;

  --primary: 145 70% 45%;
  --primary-foreground: 150 45% 4%;

  --secondary: 150 30% 10%;
  --secondary-foreground: 0 0% 96%;

  --muted: 150 20% 15%;
  --muted-foreground: 150 10% 60%;

  --accent: 150 30% 12%;
  --accent-foreground: 0 0% 96%;

  --border: 150 25% 15%;
  --input: 150 25% 12%;

  --ring: 145 70% 45%;

  --destructive: 0 70% 50%;
  --destructive-foreground: 0 0% 96%;

  --radius: 1rem;

  /* Flexooo custom colors */
  --gradient-cta: linear-gradient(
    135deg,
    hsl(145 70% 45%),
    hsl(60 90% 50%)
  );

  --glass-bg: rgba(8, 35, 24, 0.78);
  --glass-border: rgba(50, 180, 100, 0.12);

  --glow-green: 0 8px 32px rgba(32, 215, 106, 0.25);
}

/* ========================================
   RESET
   ======================================== */

* {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
}

html {
  background: hsl(var(--background));
  scroll-behavior: smooth;
}

body {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background:
    radial-gradient(
      circle at 15% 15%,
      rgba(20, 180, 90, 0.08),
      transparent 30%
    ),
    radial-gradient(
      circle at 85% 75%,
      rgba(180, 210, 20, 0.05),
      transparent 30%
    ),
    hsl(var(--background));

  color: hsl(var(--foreground));
  min-height: 100vh;
}

/* ========================================
   FORM ELEMENTS
   ======================================== */

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}

input,
textarea,
select {
  color: hsl(var(--foreground));
}

/* ========================================
   FLEXOOO SIGNUP INPUTS
   ======================================== */

.signup-input {
  width: 100%;
  height: 52px;

  padding: 0 16px 0 48px;

  border-radius: 14px;

  border: 1px solid hsl(var(--border));

  background: hsl(var(--input));

  color: hsl(var(--foreground));

  outline: none;

  font-size: 15px;

  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.signup-input::placeholder {
  color: hsl(var(--muted-foreground));
  opacity: 0.8;
}

.signup-input:hover {
  border-color: hsl(var(--primary) / 0.35);
}

.signup-input:focus {
  border-color: hsl(var(--primary));

  background: hsl(var(--input));

  box-shadow:
    0 0 0 3px hsl(var(--primary) / 0.1),
    0 0 20px hsl(var(--primary) / 0.08);
}

.signup-input:disabled {
  opacity: 0.6;
}

/* ========================================
   INPUT AUTOFILL
   ======================================== */

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: hsl(var(--foreground));

  -webkit-box-shadow:
    0 0 0 1000px hsl(var(--input)) inset;

  transition: background-color 5000s ease-in-out 0s;
}

/* ========================================
   CLEAN FORM CARD
   ======================================== */

.signup-card {
  width: 100%;

  background: var(--glass-bg);

  border: 1px solid var(--glass-border);

  border-radius: 24px;

  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 40px rgba(20, 180, 90, 0.04);
}

/* ========================================
   CTA BUTTON
   ======================================== */

.signup-button {
  width: 100%;
  height: 52px;

  border: 0;
  border-radius: 14px;

  background: var(--gradient-cta);

  color: hsl(150 30% 6%);

  font-weight: 700;
  font-size: 16px;

  box-shadow: var(--glow-green);

  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.signup-button:hover {
  transform: translateY(-1px);

  box-shadow:
    0 10px 35px rgba(32, 215, 106, 0.32);
}

.signup-button:active {
  transform: translateY(0);
}

.signup-button:disabled {
  opacity: 0.5;
  box-shadow: none;
}

/* ========================================
   LINKS
   ======================================== */

a {
  color: inherit;
  text-decoration: none;
}

a:hover {
  text-decoration: none;
}

/* ========================================
   IMAGES
   ======================================== */

img {
  max-width: 100%;
  display: block;
}

/* ========================================
   MOBILE
   ======================================== */

@media (max-width: 640px) {
  body {
    overflow-x: hidden;
  }

  .signup-input {
    height: 52px;
    font-size: 15px;
  }

  .signup-card {
    border-radius: 22px;
  }

  .signup-button {
    height: 52px;
    font-size: 16px;
  }
}

/* ========================================
   SUBTLE FLEXOOO BACKGROUND
   ======================================== */

.flexooo-background {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: hsl(var(--background));
}

.flexooo-background::before {
  content: "";

  position: absolute;
  inset: 0;

  pointer-events: none;

  background-image:
    linear-gradient(
      rgba(60, 180, 100, 0.035) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      rgba(60, 180, 100, 0.035) 1px,
      transparent 1px
    );

  background-size: 60px 60px;

  mask-image: linear-gradient(
    to bottom,
    black,
    transparent 90%
  );
}

/* ========================================
   SCROLLBAR
   ======================================== */

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--background));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted));
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--primary));
}

/* ========================================
   SELECTION
   ======================================== */

::selection {
  background: hsl(var(--primary) / 0.3);
  color: hsl(var(--foreground));
}
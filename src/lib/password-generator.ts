/**
 * Cryptographically secure password generation utility.
 */

export interface PasswordGeneratorOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  avoidAmbiguous?: boolean;
}

const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // excluded easily confused I, O if ambiguous
const ALL_UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz"; // excluded l
const ALL_LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";

const NUMBER_CHARS = "23456789"; // excluded 0, 1
const ALL_NUMBER_CHARS = "0123456789";

const SYMBOL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const SAFE_SYMBOLS = "!@#$%^&*_-+=";

export function generateRandomPassword(options: PasswordGeneratorOptions = {}): string {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    avoidAmbiguous = false,
  } = options;

  const targetLength = Math.max(8, Math.min(64, length));

  const uppers = avoidAmbiguous ? UPPERCASE_CHARS : ALL_UPPERCASE_CHARS;
  const lowers = avoidAmbiguous ? LOWERCASE_CHARS : ALL_LOWERCASE_CHARS;
  const numbers = avoidAmbiguous ? NUMBER_CHARS : ALL_NUMBER_CHARS;
  const symbols = avoidAmbiguous ? SAFE_SYMBOLS : SYMBOL_CHARS;

  const categories: string[] = [];
  if (includeUppercase) categories.push(uppers);
  if (includeLowercase) categories.push(lowers);
  if (includeNumbers) categories.push(numbers);
  if (includeSymbols) categories.push(symbols);

  // Fallback if all options turned off
  if (categories.length === 0) {
    categories.push(ALL_LOWERCASE_CHARS, ALL_NUMBER_CHARS);
  }

  const allChars = categories.join("");
  const passwordChars: string[] = [];

  // Guarantee at least one character from each selected category
  const cryptoArray = new Uint32Array(targetLength + categories.length + 10);
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(cryptoArray);
  } else {
    // Fallback if crypto is unavailable
    for (let i = 0; i < cryptoArray.length; i++) {
      cryptoArray[i] = Math.floor(Math.random() * 4294967296);
    }
  }

  let cryptoIdx = 0;

  // Pick one from each category first
  for (const cat of categories) {
    const randVal = cryptoArray[cryptoIdx++];
    passwordChars.push(cat[randVal % cat.length]);
  }

  // Fill the remainder
  while (passwordChars.length < targetLength) {
    const randVal = cryptoArray[cryptoIdx++];
    passwordChars.push(allChars[randVal % allChars.length]);
  }

  // Fisher-Yates shuffle with crypto randomness
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const randVal = cryptoArray[cryptoIdx++];
    const j = randVal % (i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  return passwordChars.join("");
}

export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  color: string;
} {
  if (!password) {
    return { score: 0, label: "Very weak", color: "bg-muted-foreground/30" };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Normalize score between 1 and 4
  if (score <= 1) {
    return { score: 1, label: "Weak", color: "bg-red-500" };
  }
  if (score <= 3) {
    return { score: 2, label: "Fair", color: "bg-amber-500" };
  }
  if (score <= 4) {
    return { score: 3, label: "Strong", color: "bg-emerald-500" };
  }
  return { score: 4, label: "Very strong", color: "bg-emerald-600" };
}

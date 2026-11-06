// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { setCurrentLanguage } from "../i18n/core";
import { en } from "../i18n/en";
import {
  AutonomiaAuthError,
  loginAutonomiaAccount,
  registerAutonomiaAccount,
} from "../lib/autonomia/api/autonomiaAuthApi";
import type { AutonomiaConsoleUser } from "../lib/autonomia/types";
import { LoginPage } from "./LoginPage";

vi.mock("../lib/autonomia/api/autonomiaAuthApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/autonomia/api/autonomiaAuthApi")>()),
  loginAutonomiaAccount: vi.fn(),
  registerAutonomiaAccount: vi.fn(),
}));

const user: AutonomiaConsoleUser = {
  id: "test-only-user",
  username: "test-user",
  email: "login-test@example.com",
  display_name: "Test User",
  role: "user",
  balance_usd: "0.00",
};
const password = "test-only-password";
const modes = ["login", "register"] as const;

function renderLogin(mode: (typeof modes)[number] = "login") {
  const onAuthenticated = vi.fn();
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <I18nProvider>
        <Routes>
          <Route path="/login" element={<LoginPage onAuthenticated={onAuthenticated} />} />
          <Route path="/overview" element={<h1>Overview</h1>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
  if (mode === "register") {
    fireEvent.click(screen.getByRole("button", { name: "Create a new account" }));
  }
  return onAuthenticated;
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  const username = screen.queryByLabelText("Username");
  if (username) fireEvent.change(username, { target: { value: user.username } });
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: /^(Sign in|Create account)$/ }));
}

beforeEach(() => {
  vi.resetAllMocks();
  setCurrentLanguage("en");
  vi.mocked(loginAutonomiaAccount).mockResolvedValue(user);
  vi.mocked(registerAutonomiaAccount).mockResolvedValue(user);
});
afterEach(() => {
  cleanup();
  setCurrentLanguage("en");
});

describe("LoginPage", () => {
  it.each(modes)("authenticates through %s before routing to overview", async (mode) => {
    const onAuthenticated = renderLogin(mode);
    fillForm();
    submitForm();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    const request = mode === "login" ? loginAutonomiaAccount : registerAutonomiaAccount;
    expect(request).toHaveBeenCalledExactlyOnceWith(
      ...(mode === "login" ? [user.email, password] : [user.email, user.username, password]),
    );
    expect(mode === "login" ? registerAutonomiaAccount : loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(user);
    expect(vi.mocked(request).mock.invocationCallOrder[0]).toBeLessThan(
      onAuthenticated.mock.invocationCallOrder[0],
    );
  });

  it.each(modes)("preserves native input constraints in %s mode", (mode) => {
    renderLogin(mode);
    const email = screen.getByLabelText<HTMLInputElement>("Email");
    const passwordInput = screen.getByLabelText<HTMLInputElement>("Password");
    expect(email.type).toBe("email");
    expect(email.required).toBe(true);
    expect(passwordInput.required).toBe(true);
    expect(passwordInput.type).toBe("password");
    expect(passwordInput.autocomplete).toBe(mode === "login" ? "current-password" : "new-password");
    expect(passwordInput.getAttribute("minlength")).toBe(mode === "register" ? "8" : null);
    if (mode === "register") {
      const username = screen.getByLabelText<HTMLInputElement>("Username");
      expect(username.required).toBe(true);
      expect(username.minLength).toBe(2);
      expect(username.maxLength).toBe(40);
    }
    submitForm();
    expect(loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(registerAutonomiaAccount).not.toHaveBeenCalled();
  });

  it("returns an accepted registration to login without authenticating", async () => {
    vi.mocked(registerAutonomiaAccount).mockResolvedValue(null);
    const onAuthenticated = renderLogin("register");
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    submitForm();

    expect((await screen.findByRole("status")).textContent).toBe(en.login.acceptedNotice);
    expect(registerAutonomiaAccount).toHaveBeenCalledExactlyOnceWith(user.email, user.username, password);
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Sign in", level: 1 })).toBeTruthy();
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Password").type).toBe("password");
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Sign in" }).disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create a new account" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(modes)("shows an AuthError from %s and clears it on mode switch", async (mode) => {
    const error = new AutonomiaAuthError({ code: "test_rejected", message: "Test credentials rejected." });
    vi.mocked(mode === "login" ? loginAutonomiaAccount : registerAutonomiaAccount).mockRejectedValue(error);
    const onAuthenticated = renderLogin(mode);
    fillForm();
    submitForm();

    expect((await screen.findByRole("alert")).textContent).toContain(error.message);
    expect(onAuthenticated).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: mode === "login" ? "Create a new account" : "Sign in instead" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("heading", { name: mode === "login" ? "Create account" : "Sign in", level: 1 }),
    ).toBeTruthy();
  });

  it.each(modes)("hides unexpected %s error details behind a generic alert", async (mode) => {
    const error = new Error("Unexpected internal test failure: do not display");
    vi.mocked(mode === "login" ? loginAutonomiaAccount : registerAutonomiaAccount).mockRejectedValue(error);
    const onAuthenticated = renderLogin(mode);
    fillForm();
    submitForm();

    expect((await screen.findByRole("alert")).textContent).toContain(en.errors.authRequestFailed);
    expect(document.body.textContent).not.toContain(error.message);
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it.each(modes)("toggles password visibility without losing its value in %s mode", (mode) => {
    renderLogin(mode);
    fillForm();
    for (const [label, type] of [
      ["Show password", "text"],
      ["Hide password", "password"],
      ["Show password", "text"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      const input = screen.getByLabelText<HTMLInputElement>("Password");
      expect(input.type).toBe(type);
      expect(input.value).toBe(password);
    }
    fireEvent.click(
      screen.getByRole("button", { name: mode === "login" ? "Create a new account" : "Sign in instead" }),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Password").type).toBe("password");
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe(password);
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect(loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(registerAutonomiaAccount).not.toHaveBeenCalled();
  });

  it.each(modes)("locks the busy %s form and prevents duplicate requests", async (mode) => {
    let resolve!: (value: AutonomiaConsoleUser) => void;
    const pending = new Promise<AutonomiaConsoleUser>((done) => {
      resolve = done;
    });
    const request = mode === "login" ? loginAutonomiaAccount : registerAutonomiaAccount;
    vi.mocked(request).mockReturnValue(pending);
    const onAuthenticated = renderLogin(mode);
    fillForm();
    const form = screen.getByRole("form");
    expect(form.getAttribute("aria-busy")).toBe("false");
    submitForm();

    expect(form.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole<HTMLFieldSetElement>("group").disabled).toBe(true);
    const submit = screen.getByRole<HTMLButtonElement>("button", { name: "Working…" });
    const switchMode = screen.getByRole<HTMLButtonElement>("button", {
      name: mode === "login" ? "Create a new account" : "Sign in instead",
    });
    expect(submit.disabled).toBe(true);
    expect(switchMode.disabled).toBe(true);
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Password").matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Show password" }).matches(":disabled")).toBe(true);
    fireEvent.click(submit);
    fireEvent.click(switchMode);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(request).toHaveBeenCalledOnce();
    expect(mode === "login" ? registerAutonomiaAccount : loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.getByRole("form", { name: mode === "login" ? "Sign in" : "Create account" })).toBe(form);

    await act(async () => resolve(user));
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(user);
    expect(request).toHaveBeenCalledOnce();
  });

  it.each(modes)("preserves public navigation in %s mode", (mode) => {
    renderLogin(mode);
    for (const [name, href] of [
      ["Autonomia", "/home"],
      ["← Back to home", "/home"],
      ["Models", "/models"],
      ["Quick start", "/docs"],
    ]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }
  });

  it.each(modes)("preserves typed %s values when switching languages", (mode) => {
    const onAuthenticated = renderLogin(mode);
    fillForm();
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "fr" } });

    expect(
      screen.getByRole("heading", { name: mode === "login" ? "Se connecter" : "Créer un compte", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Langue" }).value).toBe("fr");
    expect(screen.getByLabelText<HTMLInputElement>("Adresse e-mail").value).toBe(user.email);
    expect(screen.getByLabelText<HTMLInputElement>("Mot de passe").value).toBe(password);
    if (mode === "register") {
      expect(screen.getByLabelText<HTMLInputElement>("Nom d'utilisateur").value).toBe(user.username);
    }
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(loginAutonomiaAccount).not.toHaveBeenCalled();
    expect(registerAutonomiaAccount).not.toHaveBeenCalled();
  });
});

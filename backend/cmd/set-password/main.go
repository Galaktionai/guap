// Command set-password sets a new password for an existing account,
// found by email. It is the manual password reset until reset by email
// exists: there is no way to recover the old password, only to replace it.
//
// Usage:
//
//	set-password <email>
//
// The new password is read from the terminal without echoing it, so it does
// not appear on screen or in the shell history. All of that user's sessions
// end, so anyone signed in with the old password is signed out.
//
// Environment:
//
//	DB_PATH  SQLite database file (default "guap.db")
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"unicode/utf8"

	"golang.org/x/term"

	"guap/backend/internal/auth"
	"guap/backend/internal/store"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Ошибка:", err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) != 2 {
		return errors.New("укажите email: set-password <email>")
	}
	email := strings.ToLower(strings.TrimSpace(os.Args[1]))
	if email == "" {
		return errors.New("email не может быть пустым")
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "guap.db"
	}

	ctx := context.Background()
	st, err := store.Open(ctx, dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	// Fail early with a clear message if the email is unknown.
	if _, _, err := st.UserByEmail(ctx, email); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return fmt.Errorf("пользователь с email %q не найден", email)
		}
		return err
	}

	password, err := readPassword()
	if err != nil {
		return err
	}
	if n := utf8.RuneCountInString(password); n < 8 || n > 128 {
		return errors.New("пароль должен быть от 8 до 128 символов")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	if err := st.SetPassword(ctx, email, hash); err != nil {
		return err
	}

	fmt.Printf("Пароль для %s изменён. Активные сессии завершены.\n", email)
	return nil
}

// readPassword asks for the new password twice, without echoing it, and
// checks that both entries match.
func readPassword() (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errors.New("запустите команду в терминале: пароль читается без отображения")
	}
	fmt.Print("Новый пароль: ")
	first, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", err
	}
	fmt.Print("Повторите пароль: ")
	second, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", err
	}
	if string(first) != string(second) {
		return "", errors.New("пароли не совпадают")
	}
	return string(first), nil
}

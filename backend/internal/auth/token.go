package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"time"
)

// SessionTTL is how long a session lives without use. Each request made in
// its second half extends it, so an app used at least every few weeks
// stays signed in.
const SessionTTL = 90 * 24 * time.Hour

// NewToken returns a random session token for the client and the hash to
// store on the server.
func NewToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token), nil
}

// HashToken returns the stored form of a token. Tokens are long and random,
// so a fast hash is enough; slow hashing is only needed for passwords.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

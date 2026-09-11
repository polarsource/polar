// Package polarapi is a minimal HTTP client for the subset of the Polar API
// used by the Terraform provider. It intentionally avoids depending on any
// published SDK so the provider is insulated from SDK release cycles.
package polarapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	ServerProduction = "https://api.polar.sh"
	ServerSandbox    = "https://sandbox-api.polar.sh"

	maxAttempts = 5
)

// Variables so tests can shrink the retry delays.
var (
	initialBackoff = 500 * time.Millisecond
	maxBackoff     = 10 * time.Second
)

type Client struct {
	baseURL    string
	token      string
	userAgent  string
	httpClient *http.Client
}

func New(baseURL, token, userAgent string) *Client {
	return &Client{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		token:      token,
		userAgent:  userAgent,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// APIError is a non-2xx response from the Polar API.
type APIError struct {
	StatusCode int
	Detail     string
	Body       string
}

func (e *APIError) Error() string {
	detail := e.Detail
	if detail == "" {
		detail = e.Body
	}
	return fmt.Sprintf("polar API error (HTTP %d): %s", e.StatusCode, detail)
}

func IsNotFound(err error) bool {
	apiErr, ok := err.(*APIError)
	return ok && apiErr.StatusCode == http.StatusNotFound
}

// do performs a request against the Polar API, decoding the JSON response into
// out when out is non-nil. Requests are retried on 429 responses (the request
// was never processed); GET requests are additionally retried on 5xx responses
// since they are safe to repeat. Writes are never retried on 5xx: the server
// may have applied the change before failing.
func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encoding request body: %w", err)
		}
	}

	backoff := initialBackoff
	var lastErr error
	for attempt := range maxAttempts {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
			backoff = min(backoff*2, maxBackoff)
		}

		var reqBody io.Reader
		if payload != nil {
			reqBody = bytes.NewReader(payload)
		}
		req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+c.token)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", c.userAgent)
		if payload != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if method == http.MethodGet {
				lastErr = err
				continue
			}
			return err
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return fmt.Errorf("reading response body: %w", err)
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out == nil || len(respBody) == 0 {
				return nil
			}
			if err := json.Unmarshal(respBody, out); err != nil {
				return fmt.Errorf("decoding response body: %w", err)
			}
			return nil
		}

		apiErr := &APIError{
			StatusCode: resp.StatusCode,
			Detail:     extractDetail(respBody),
			Body:       string(respBody),
		}
		retryable := resp.StatusCode == http.StatusTooManyRequests ||
			(method == http.MethodGet && resp.StatusCode >= 500)
		if !retryable {
			return apiErr
		}
		lastErr = apiErr
		if wait := retryAfter(resp); wait > 0 {
			backoff = min(wait, maxBackoff)
		}
	}
	return lastErr
}

func retryAfter(resp *http.Response) time.Duration {
	header := resp.Header.Get("Retry-After")
	if header == "" {
		return 0
	}
	seconds, err := strconv.Atoi(header)
	if err != nil || seconds <= 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}

// extractDetail pulls a human-readable message out of the two error shapes the
// Polar API produces: {"detail": "message"} for status-coded errors and
// {"detail": [{"loc": [...], "msg": "..."}]} for request validation errors.
func extractDetail(body []byte) string {
	var envelope struct {
		Detail json.RawMessage `json:"detail"`
		Error  string          `json:"error"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return ""
	}

	var detail string
	if len(envelope.Detail) > 0 {
		var message string
		if err := json.Unmarshal(envelope.Detail, &message); err == nil {
			detail = message
		} else {
			var validationErrors []struct {
				Loc []any  `json:"loc"`
				Msg string `json:"msg"`
			}
			if err := json.Unmarshal(envelope.Detail, &validationErrors); err == nil {
				messages := make([]string, 0, len(validationErrors))
				for _, validationError := range validationErrors {
					location := make([]string, 0, len(validationError.Loc))
					for _, part := range validationError.Loc {
						location = append(location, fmt.Sprintf("%v", part))
					}
					messages = append(messages, fmt.Sprintf("%s: %s", strings.Join(location, "."), validationError.Msg))
				}
				detail = strings.Join(messages, "; ")
			}
		}
	}
	if detail == "" {
		detail = envelope.Error
	}
	return detail
}

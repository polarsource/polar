package polarapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func fastRetries(t *testing.T) {
	t.Helper()
	previousInitial, previousMax := initialBackoff, maxBackoff
	initialBackoff, maxBackoff = time.Millisecond, 5*time.Millisecond
	t.Cleanup(func() { initialBackoff, maxBackoff = previousInitial, previousMax })
}

func TestRequestHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer polar_oat_test" {
			t.Errorf("Authorization = %q", got)
		}
		if got := r.Header.Get("User-Agent"); got != "terraform-provider-polar/test" {
			t.Errorf("User-Agent = %q", got)
		}
		if got := r.URL.Path; got != "/v1/meters/some-id" {
			t.Errorf("path = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "some-id"})
	}))
	defer server.Close()

	client := New(server.URL, "polar_oat_test", "terraform-provider-polar/test")
	var out struct {
		ID string `json:"id"`
	}
	if err := client.do(context.Background(), http.MethodGet, "/v1/meters/some-id", nil, &out); err != nil {
		t.Fatal(err)
	}
	if out.ID != "some-id" {
		t.Errorf("decoded ID = %q", out.ID)
	}
}

func TestNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"detail": "Custom field not found."}`))
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	err := client.do(context.Background(), http.MethodGet, "/v1/custom-fields/x", nil, nil)
	if !IsNotFound(err) {
		t.Fatalf("expected not-found error, got %v", err)
	}
	if !strings.Contains(err.Error(), "Custom field not found.") {
		t.Errorf("error message should carry the API detail, got %q", err.Error())
	}
}

func TestRetryOn429(t *testing.T) {
	fastRetries(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	if err := client.do(context.Background(), http.MethodPost, "/v1/meters/", map[string]any{}, nil); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Errorf("expected 2 attempts, got %d", calls.Load())
	}
}

func TestNoRetryForWritesOn500(t *testing.T) {
	fastRetries(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	err := client.do(context.Background(), http.MethodPost, "/v1/meters/", map[string]any{}, nil)
	if err == nil {
		t.Fatal("expected an error")
	}
	if calls.Load() != 1 {
		t.Errorf("writes must not be retried on 5xx: got %d attempts", calls.Load())
	}
}

func TestRetryForReadsOn500(t *testing.T) {
	fastRetries(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	if err := client.do(context.Background(), http.MethodGet, "/v1/meters/x", nil, nil); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Errorf("expected 2 attempts, got %d", calls.Load())
	}
}

func TestValidationErrorDetail(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"detail": [{"loc": ["body", "name"], "msg": "String should have at least 3 characters", "type": "string_too_short"}]}`))
	}))
	defer server.Close()

	client := New(server.URL, "token", "test")
	err := client.do(context.Background(), http.MethodPost, "/v1/meters/", map[string]any{}, nil)
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("StatusCode = %d", apiErr.StatusCode)
	}
	if !strings.Contains(apiErr.Detail, "body.name: String should have at least 3 characters") {
		t.Errorf("Detail = %q", apiErr.Detail)
	}
}

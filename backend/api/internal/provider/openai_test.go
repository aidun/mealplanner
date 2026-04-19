package provider

import "testing"

func TestExtractOutputTextPrefersOutputText(t *testing.T) {
	text, err := extractOutputText([]byte(`{"output_text":"{\"id\":\"x\"}"}`))
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"id":"x"}` {
		t.Fatalf("unexpected text: %s", text)
	}
}

func TestExtractOutputTextFromOutputContent(t *testing.T) {
	text, err := extractOutputText([]byte(`{"output":[{"content":[{"type":"output_text","text":"{\"id\":\"x\"}"}]}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"id":"x"}` {
		t.Fatalf("unexpected text: %s", text)
	}
}

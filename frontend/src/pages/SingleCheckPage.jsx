import React, { useState } from "react";
import {
  Box, TextField, Button, CircularProgress, Alert,
  Paper, Typography, LinearProgress, Chip,
} from "@mui/material";
import { predictSpam } from "../services/spamApi";

const EXAMPLES = [
  "Congratulations! You've won a $1000 Walmart gift card. Click here to claim now!",
  "Hey, are we still meeting for lunch tomorrow at noon?",
  "URGENT: Your account has been compromised. Verify now to avoid suspension.",
  "Can you send me the report before the meeting?",
];

export default function SingleCheckPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await predictSpam(text);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to check message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Check a Message</Typography>

      {/* Quick examples */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        {EXAMPLES.map((ex, i) => (
          <Chip
            key={i}
            label={`Example ${i + 1}`}
            size="small"
            variant="outlined"
            onClick={() => setText(ex)}
            clickable
          />
        ))}
      </Box>

      <TextField
        fullWidth
        multiline
        rows={4}
        label="Enter message text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={!text.trim() || loading}
        onClick={handleCheck}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
      >
        {loading ? "Checking..." : "Check for Spam"}
      </Button>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {result && (
        <Paper
          elevation={2}
          sx={{
            mt: 3, p: 3,
            borderLeft: 6,
            borderColor: result.is_spam ? "error.main" : "success.main",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Chip
              label={result.is_spam ? "🚨 SPAM" : "✅ HAM (Not Spam)"}
              color={result.is_spam ? "error" : "success"}
              size="medium"
              sx={{ fontWeight: "bold", fontSize: "1rem", px: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </Typography>
          </Box>

          {/* Confidence bars */}
          {Object.entries(result.scores).map(([label, score]) => (
            <Box key={label} sx={{ mb: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="body2" textTransform="capitalize">{label}</Typography>
                <Typography variant="body2">{(score * 100).toFixed(1)}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={score * 100}
                color={label === "spam" ? "error" : "success"}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}

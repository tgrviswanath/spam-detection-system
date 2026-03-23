import React, { useState } from "react";
import {
  Box, TextField, Button, CircularProgress, Alert,
  Typography, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Chip, TableContainer,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { predictBatch } from "../services/spamApi";

const PLACEHOLDER = `Win a free iPhone! Click here now!
Can we reschedule tomorrow's meeting?
URGENT: Claim your prize before it expires!
Are you coming to the party on Saturday?`;

export default function BatchCheckPage() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBatch = async () => {
    const texts = input.split("\n").map((t) => t.trim()).filter(Boolean);
    if (!texts.length) return;
    setLoading(true);
    setError("");
    try {
      const res = await predictBatch(texts);
      setResults(res.data.map((r, i) => ({ ...r, text: texts[i] })));
    } catch (e) {
      setError(e.response?.data?.detail || "Batch check failed.");
    } finally {
      setLoading(false);
    }
  };

  const spamCount = results.filter((r) => r.is_spam).length;
  const hamCount = results.length - spamCount;
  const chartData = results.length
    ? [
        { name: "Spam", count: spamCount, fill: "#f44336" },
        { name: "Ham", count: hamCount, fill: "#4caf50" },
      ]
    : [];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Batch Check (one message per line)</Typography>

      <TextField
        fullWidth
        multiline
        rows={6}
        label="Enter messages (one per line)"
        placeholder={PLACEHOLDER}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={!input.trim() || loading}
        onClick={handleBatch}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
      >
        {loading ? "Checking..." : "Check All Messages"}
      </Button>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {results.length > 0 && (
        <Box sx={{ mt: 3 }}>
          {/* Summary chart */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Summary: {spamCount} spam / {hamCount} ham out of {results.length} messages
          </Typography>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={40} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Results table */}
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Confidence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i} sx={{ bgcolor: r.is_spam ? "error.50" : "success.50" }}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.text}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.is_spam ? "SPAM" : "HAM"}
                        color={r.is_spam ? "error" : "success"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{(r.confidence * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

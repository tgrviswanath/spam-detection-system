import React, { useState } from "react";
import { Container, Box, Tabs, Tab } from "@mui/material";
import Header from "./components/Header";
import SingleCheckPage from "./pages/SingleCheckPage";
import BatchCheckPage from "./pages/BatchCheckPage";

export default function App() {
  const [tab, setTab] = useState(0);
  return (
    <>
      <Header />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Single Check" />
          <Tab label="Batch Check" />
        </Tabs>
        <Box>{tab === 0 ? <SingleCheckPage /> : <BatchCheckPage />}</Box>
      </Container>
    </>
  );
}

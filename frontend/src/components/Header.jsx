import { AppBar, Toolbar, Typography } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";

export default function Header() {
  return (
    <AppBar position="static" color="primary">
      <Toolbar sx={{ gap: 1 }}>
        <SecurityIcon />
        <Typography variant="h6" fontWeight="bold">
          Spam Detection System
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#3b82f6", // electric blue
    },
    secondary: {
      main: "#22d3ee", // cyan accent
    },
    background: {
      default: "#020617", // near-black / deep charcoal
      paper: "rgba(15,23,42,0.92)", // dark glass
    },
    text: {
      primary: "#e5e7eb", // soft white
      secondary: "#9ca3af", // muted gray
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#020617",
          color: "#e5e7eb",
          backgroundImage:
            "radial-gradient(circle at 0 0, rgba(56,189,248,0.10), transparent 55%), radial-gradient(circle at 100% 100%, rgba(37,99,235,0.12), transparent 55%)",
          minHeight: "100vh",
        },
        "#root": {
          minHeight: "100vh",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(15,23,42,0.92)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(148,163,184,0.3)",
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.6)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 999,
          fontWeight: 500,
          letterSpacing: 0.02,
          transition:
            "background-color 200ms ease-out, box-shadow 200ms ease-out, transform 200ms ease-out",
          "&:hover": {
            transform: "scale(1.03)",
            boxShadow: "0 0 0 1px rgba(59,130,246,0.6)",
          },
        },
        containedPrimary: {
          boxShadow: "0 0 0 1px rgba(37,99,235,0.6)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(17,24,39,0.95))",
          borderBottom: "1px solid rgba(31,41,55,0.9)",
          boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(15,23,42,0.92)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.6))",
        },
      },
    },
  },
});

export default darkTheme;









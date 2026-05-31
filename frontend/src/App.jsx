import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CompanyDetails from "./pages/CompanyDetails";
import LandingPage from "./pages/LandingPage";
import Layout from "./layouts/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import StartupDashboard from "./pages/dashboard/StartupDashboard";
import InvestorDashboard from "./pages/dashboard/InvestorDashboard";
import PortfolioDashboard from "./pages/portfolio/PortfolioDashboard";

import PublicRoute from "./components/PublicRoute";
import Chatbot from "./components/Chatbot";

function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />

          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          {/* Protected Startup Routes */}
          <Route element={<ProtectedRoute allowedRoles={["founder"]} />}>
            <Route path="/dashboard/startup" element={<StartupDashboard />} />
          </Route>

          {/* Protected Investor Routes */}
          <Route element={<ProtectedRoute allowedRoles={["investor"]} />}>
            <Route path="/company/:ticker" element={<CompanyDetails />} />
            <Route path="/dashboard/investor" element={<InvestorDashboard />} />
            <Route path="/portfolio" element={<PortfolioDashboard />} />
          </Route>          
        </Route>
      </Routes>
      <Chatbot />
    </>
  );
}

export default App

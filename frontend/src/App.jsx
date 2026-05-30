import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CompanyDetails from "./pages/CompanyDetails";
import LandingPage from "./pages/LandingPage";

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

          {/* Protected Investor Routes */}
          <Route element={<ProtectedRoute allowedRoles={["investor"]} />}>
            <Route path="/company/:ticker" element={<CompanyDetails />} />
          </Route>          
        </Route>
      </Routes>
      <Chatbot />
    </>
  );
}

export default App

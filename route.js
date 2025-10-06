import express from "express";
import axios from "axios";
import fs from "fs";

const app = express();
app.use(express.json());

// Read configuration
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
const PORT = config.server.port || 3000;
const GOOGLE_MAPS_API_KEY = config.google_maps.api_key;
const CAPTCHA_SECRET_KEY = config.captcha.secret_key;

// Function to validate Google reCAPTCHA token
async function verifyCaptcha(token) {
  const url = `https://www.google.com/recaptcha/api/siteverify`;
  const params = new URLSearchParams();
  params.append("secret", CAPTCHA_SECRET_KEY);
  params.append("response", token);

  const response = await axios.post(url, params);
  return response.data.success;
}

// Function to fetch and rank routes
async function getOptimizedRoute(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await axios.get(url);
  const routes = response.data.routes;

  if (!routes.length) throw new Error("No routes found");

  const rankedRoutes = routes.map((route) => {
    const distance = route.legs[0].distance.value;
    const duration = route.legs[0].duration.value;
    const trafficDuration = route.legs[0].duration_in_traffic
      ? route.legs[0].duration_in_traffic.value
      : duration;

    const score = (distance / 1000) * 0.3 + (trafficDuration / 60) * 0.7;
    return { route, score };
  });

  rankedRoutes.sort((a, b) => a.score - b.score);

  return rankedRoutes.slice(0, 3).map((r, index) => ({
    rank: index + 1,
    summary: r.route.summary,
    distance: r.route.legs[0].distance.text,
    duration: r.route.legs[0].duration.text,
    polyline: r.route.overview_polyline.points
  }));
}

// API endpoint with CAPTCHA validation
app.post("/api/route", async (req, res) => {
  try {
    const { origin, destination, captchaToken } = req.body;

    if (!captchaToken)
      return res.status(400).json({ error: "Missing CAPTCHA token" });

    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid)
      return res.status(403).json({ error: "Invalid CAPTCHA verification" });

    if (!origin || !destination)
      return res.status(400).json({ error: "Missing origin or destination" });

    const suggestions = await getOptimizedRoute(origin, destination);
    res.json({
      message: "✅ Route suggestions generated successfully",
      suggestions
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

app.listen(PORT, () =>
  console.log(`🚗 Uber Route Optimizer running on port ${PORT}`)
);

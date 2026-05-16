# Smart Krishi Market
# Smart Krishi Market

## Project Overview

Smart Krishi Market is an AI-powered agriculture marketplace platform that helps farmers decide:

- When to sell crops
- Whether to hold or sell
- Expected market demand
- Predicted mandi prices
- Best nearby buyers and markets

The platform connects:

- Farmers
- Buyers
- Markets

using AI prediction and real Agmarknet/data.gov.in datasets.

---

# Tech Stack

## Frontend
- React + Vite
- Tailwind CSS
- React Router
- Axios
- Context API

## Backend
- Node.js
- Express.js
- JWT Authentication
- bcrypt
- PostgreSQL
- MVC Architecture

## ML Service
- Python FastAPI
- XGBoost
- Pandas
- Scikit-learn

## Database
- PostgreSQL

---

# Main Features

## Farmer Features
- Register/Login
- Upload crop listing
- Upload crop image
- View AI prediction
- View demand forecast
- Hold/Sell recommendation
- View market prices

## Buyer Features
- Register/Login
- Browse crop listings
- Contact farmers
- View crop details

## AI Features
- Crop price prediction
- Demand prediction
- Best selling time prediction
- Hold/Sell recommendation
- Historical mandi price analysis

---

# Folder Structure

smart krishi market/

frontend/
- React frontend
- UI components
- Pages
- API integration

backend/
- Express backend
- APIs
- Authentication
- PostgreSQL queries

ml-service/
- ML prediction service
- CSV preprocessing
- XGBoost model
- Prediction APIs

database/
- SQL schema
- Seed scripts
- PostgreSQL setup

docs/
- Documentation
- API docs

assets/
- Images
- Static files

---

# Backend Rules

- Use MVC architecture
- Use REST APIs
- Use JWT auth
- Use bcrypt password hashing
- Use middleware for auth
- Keep code modular
- Do not modify frontend files

---

# Frontend Rules

- Use responsive UI
- Use Tailwind CSS
- Keep components reusable
- Use Axios for APIs
- Keep pages clean and modern
- Do not modify backend files

---

# ML Service Rules

- Use Agmarknet/data.gov.in CSV data
- Use XGBoost model
- Expose FastAPI endpoints
- Return JSON predictions
- Keep preprocessing modular

---

# APIs

## Auth APIs
- POST /api/auth/register
- POST /api/auth/login

## Crop APIs
- GET /api/crops
- POST /api/crops
- GET /api/crops/:id

## Prediction APIs
- POST /api/predict
- GET /api/market-prices

---

# Roles

## Farmer
Can:
- Upload crops
- View predictions
- Manage listings

## Buyer
Can:
- Browse listings
- Contact farmers

## Admin
Can:
- Manage users
- Manage markets

---

# AI Prediction Flow

Farmer uploads:
- Crop
- Quantity
- Location
- Harvest date
- Storage availability

System checks:
- Historical mandi data
- Current market trends
- Demand patterns

ML model predicts:
- Future price
- Demand
- Sell/Hold recommendation

---

# Team Division

## Frontend Team
Works only inside:
- /frontend

## Backend Team
Works only inside:
- /backend

## ML Team
Works only inside:
- /ml-service

## Database Team
Works only inside:
- /database

---

# Important Rules

- Never overwrite another team's folder
- Keep environment variables secure
- Do not commit secrets
- Keep APIs modular
- Use clean code practices

---

# Deployment Targets

Frontend:
- Vercel

Backend:
- Render/Railway

ML Service:
- Render/Railway

Database:
- PostgreSQL

---

# Goal

Build a production-like AI agriculture platform for hackathon judging with:
- Real datasets
- AI predictions
- Modern UI
- Scalable architecture
- Real-world usability
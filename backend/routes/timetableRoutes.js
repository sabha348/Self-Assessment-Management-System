const express = require("express");
const { 
    createEntry, 
    getEntries, 
    getEntriesByDay,
    updateEntry, 
    deleteEntry 
} = require('../controllers/timetableController');
const {authenticateToken} = require("../middleware/authenticate");
const router = express.Router();

// Create new timetable entry
router.post("/", authenticateToken, createEntry);

// Get all entries for the authenticated user
router.get("/", authenticateToken, getEntries);

// Get entries for a specific day
router.get("/day/:day", authenticateToken, getEntriesByDay);

// Update a specific entry by ID
router.put("/:id", authenticateToken, updateEntry);

// Delete a specific entry by ID
router.delete("/:id", authenticateToken, deleteEntry);

module.exports = router;
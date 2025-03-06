const express = require("express");
const { createEntry, getEntries, updateEntry, updateSubject, deleteSubject } = require('../controllers/timetableController');
const authenticateToken = require("../middleware/authenticate");
const router = express.Router();

router.post("/",authenticateToken, createEntry);
router.get("/",authenticateToken, getEntries);
router.put("/",authenticateToken, updateEntry);
router.put("/update-subject",authenticateToken,updateSubject);
router.delete("/delete-subject",authenticateToken,deleteSubject);


module.exports = router;
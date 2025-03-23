module.exports = (requiredMembership) => {
    return (req, res, next) => {
        if(!req.user || !req.user.membership) {
            return res.status(403).json({ message: "Access Denied" });
        }
        
        const allowedMembership = ['premium','free'];
        if (
            allowedMembership.indexOf(req.user.membership) >= 
            allowedMembership.indexOf(requiredMembership)
        ) {
            return next();
        }

        return res.status(403).json({ message: "Upgrade to access this feature"});
    };
};
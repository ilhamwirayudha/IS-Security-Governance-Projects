const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: "98927421292-drhjclh9ilhfte9rnim8dmqjrcf069kr.apps.googleusercontent.com",
    clientSecret: "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",
    callbackURL: "http://localhost:3000/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account"
    })
);

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
        res.redirect("/profile");
    }
);

app.get("/profile", (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/auth/google");
    }
    res.render("profile", { user: req.user });
});

app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/');
    });
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
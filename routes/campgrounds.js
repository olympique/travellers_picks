var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

// INDEX route - show all campgrounds
router.get("/campgrounds", function(req, res){
    // Get all campgrounds from DB
    Campground.find({}, function(err, allCampgrounds){
    	if(err){
           	console.log(err);
       	} else {
          	res.render("campgrounds/index", {campgrounds: allCampgrounds, page: "campgrounds"});
       	}
    });
});

// NEW route - show form to create a new campground
router.get("/campgrounds/new", middleware.isLoggedIn, function(req, res){
	res.render("campgrounds/new");
});

// CREATE route - create and add a new campground
router.post("/campgrounds", middleware.isLoggedIn, function(req, res){
	// get data from form and add to campgrounds array
  	var name = req.body.name;
	var price = req.body.price;
  	var image = req.body.image;
  	var desc = req.body.description;
  	var author = {
      	id: req.user._id,
      	username: req.user.username
  	};
  	geocoder.geocode(req.body.location, function(err, data) {
    	if (err || !data.length) {
			console.log(err);
      		req.flash("error", "Invalid address!");
      		return res.redirect("back");
    	}
    	var lat = data[0].latitude;
    	var lng = data[0].longitude;
    	var location = data[0].formattedAddress;
    	var newCampground = {name: name, price: price, image: image, description: desc, author:author, location: location, lat: lat, lng: lng};
		// Create a new campground and save to DB
		Campground.create(newCampground, function(err, newlyCreated){
			if(err){
				console.log(err);
			} else {
				console.log(newlyCreated);
				res.redirect("/campgrounds");
			}
    	});
  	});
});

// SHOW route - shows info about one campground
router.get("/campgrounds/:id", function(req, res){
	// find the campground with given ID
	Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
		if(err || !foundCampground){
			req.flash("error", "Campground not found!");
			res.redirect("back");
		} else {
			// render show template with the campground
			res.render("campgrounds/show", {campground: foundCampground});
		}
	});
});

// EDIT route - edit a campground
router.get("/campgrounds/:id/edit", middleware.checkCampgroundOwnership, function(req, res){
	Campground.findById(req.params.id, function(err, foundCampground){
		// render edit template with the campground
		res.render("campgrounds/edit", {campground: foundCampground});
	});
});

// UPDATE route - update a campground
router.put("/campgrounds/:id", middleware.checkCampgroundOwnership, function(req, res){
  	geocoder.geocode(req.body.location, function (err, data) {
    	if (err || !data.length) {
      		req.flash("error", "Invalid address!");
      		return res.redirect("back");
    	}
		req.body.campground.lat = data[0].latitude;
		req.body.campground.lng = data[0].longitude;
		req.body.campground.location = data[0].formattedAddress;

		Campground.findByIdAndUpdate(req.params.id, req.body.campground, function(err, campground){
			if(err){
				req.flash("error", err.message);
				res.redirect("back");
			} else {
				req.flash("success","Campground successfully updated!");
				res.redirect("/campgrounds/" + req.params.id);
			}
    	});
  	});
});

// DESTROY route - delete a campground
router.delete("/campgrounds/:id", middleware.checkCampgroundOwnership, function(req, res){
   Campground.findByIdAndRemove(req.params.id, function(err){
      if(err){
          res.redirect("/campgrounds");
      } else {
          res.redirect("/campgrounds");
      }
   });
});

module.exports = router;
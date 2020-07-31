var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var Review = require("../models/review");
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
	Campground.findById(req.params.id).populate("comments likes").populate({
        path: "reviews",
        options: {sort: {createdAt: -1}}
    }).exec(function(err, foundCampground){
		if(err || !foundCampground){
			req.flash("error", "Destination not found!");
			res.redirect("back");
		} else {
			// render show template with the campground
			res.render("campgrounds/show", {campground: foundCampground});
		}
	});
});

// LIKE route - like a campground
router.post("/campgrounds/:id/like", middleware.isLoggedIn, function (req, res) {
    Campground.findById(req.params.id, function (err, foundCampground) {
        if (err) {
            console.log(err);
            return res.redirect("/campgrounds");
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundCampground.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundCampground.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundCampground.likes.push(req.user);
        }

        foundCampground.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/campgrounds");
            }
            return res.redirect("/campgrounds/" + foundCampground._id);
        });
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
		
		delete req.body.campground.rating;
		// Campground.findByIdAndUpdate(req.params.id, req.body.campground, function(err, campground){
		// 	if(err){
		// 		req.flash("error", err.message);
		// 		res.redirect("back");
		// 	} else {
		// 		req.flash("success","Destination successfully updated!");
		// 		res.redirect("/campgrounds/" + req.params.id);
		// 	}
		// });
		Campground.findById(req.params.id, function (err, campground) {
			if (err) {
				console.log(err);
				res.redirect("/campgrounds");
			} else {
				campground.name = req.body.campground.name;
				campground.description = req.body.campground.description;
				campground.image = req.body.campground.image;
				campground.save(function (err) {
					if (err) {
						console.log(err);
						res.redirect("/campgrounds");
					} else {
						res.redirect("/campgrounds/" + campground._id);
					}
				});
			}
		});
  	});
});

// DESTROY route - delete a campground
// router.delete("/campgrounds/:id", middleware.checkCampgroundOwnership, function(req, res){
//    Campground.findByIdAndRemove(req.params.id, function(err){
//       if(err){
//           res.redirect("/campgrounds");
//       } else {
//           res.redirect("/campgrounds");
//       }
//    });
// });

// DESTROY route - delete a campground along with all reviews and comments associated with it
router.delete("/campgrounds/:id", middleware.checkCampgroundOwnership, function (req, res) {
    Campground.findById(req.params.id, function (err, campground) {
        if (err) {
            res.redirect("/campgrounds");
        } else {
            // deletes all comments associated with the campground
            Comment.remove({"_id": {$in: campground.comments}}, function (err) {
                if (err) {
                    console.log(err);
                    return res.redirect("/campgrounds");
                }
                // deletes all reviews associated with the campground
                Review.remove({"_id": {$in: campground.reviews}}, function (err) {
                    if (err) {
                        console.log(err);
                        return res.redirect("/campgrounds");
                    }
                    //  delete the campground
                    campground.remove();
                    req.flash("success", "Destination deleted successfully!");
                    res.redirect("/campgrounds");
                });
            });
        }
    });
});

module.exports = router;
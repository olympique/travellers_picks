var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var Review = require("../models/review");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error("Please upload an image file."), false);
    }
    cb(null, true);
};
var upload = multer({storage: storage, fileFilter: imageFilter})

var cloudinary = require("cloudinary");
cloudinary.config({ 
  	cloud_name: "olympique", 
  	api_key: process.env.CLOUDINARY_API_KEY, 
  	api_secret: process.env.CLOUDINARY_API_SECRET
});
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};

var geocoder = NodeGeocoder(options);

// INDEX route - show all campgrounds
router.get("/campgrounds", function(req, res){
	var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
	var noMatch = null;
	
	if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count({name: regex}).exec(function (err, count) {
                if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if(allCampgrounds.length < 1) {
                        noMatch = "No destinations matched your search. Please try again.";
                    }
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: req.query.search
                    });
                }
            });
        });
    } else {
		// Get all campgrounds from DB
		Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false
                    });
                }
            });
        });
	}
});

// NEW route - show form to create a new campground
router.get("/campgrounds/new", middleware.isLoggedIn, function(req, res){
	res.render("campgrounds/new");
});

// CREATE route - create and add a new campground
router.post("/campgrounds", middleware.isLoggedIn, upload.single("image"), function(req, res) {
	cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
		if(err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		// add cloudinary url for the image to the campground object under image property
		req.body.image = result.secure_url;
		// add image's public_id to campground object
		req.body.imageId = result.public_id;
		// add author to campground
		req.body.author = {
			id: req.user._id,
			username: req.user.username
		}
		
		geocoder.geocode(req.body.location, function (err, data) {
			if (err || !data.length) {
				console.log(err);
				req.flash("error", "Invalid address!");
      			return res.redirect("back");
			}
			// get data from form and add to campgrounds array
			var name = req.body.name;
			var price = req.body.price;
			var image = req.body.image;
			var imageId = req.body.imageId;
			var description = req.body.description;
			var author = {
				id: req.user._id,
				username: req.user.username
			};
			var lat = data[0].latitude;
			var lng = data[0].longitude;
			var location = data[0].formattedAddress;
			var newCampground = {
				name: name,
				price: price,
				image: image,
				description: description, 
				author: author,
				location: location,
				lat: lat,
				lng: lng
			};
			// Create a new campground and save to DB
			Campground.create(newCampground, function(err, campground) {
				if (err) {
					req.flash("error", err.message);
					return res.redirect("back");
				} else {
				res.redirect("/campgrounds/" + campground.slug);
				}	
			});
		});
	});
});

// SHOW route - shows info about one campground
router.get("/campgrounds/:slug", function(req, res){
	Campground.findOne({slug: req.params.slug}).populate("comments likes").populate({
	path: "reviews",
	options: {sort: {createdAt: -1}}
	}).exec(function(err, foundCampground){
		if(err || !foundCampground){
			console.log(err);
			req.flash("error", "Destination not found!");
			res.redirect("back");
		} else {
			// render show template with the campground
			res.render("campgrounds/show", {campground: foundCampground});
		}
	});
});

// LIKE route - like a campground
router.post("/campgrounds/:slug/like", middleware.isLoggedIn, function (req, res) {
    Campground.findOne({slug: req.params.slug}, function (err, foundCampground) {
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
            return res.redirect("/campgrounds/" + foundCampground.slug);
        });
    });
});

// EDIT route - edit a campground
router.get("/campgrounds/:slug/edit", middleware.checkCampgroundOwnership, function(req, res){
	Campground.findOne({slug: req.params.slug}, function (err, foundCampground) {
		// render edit template with the campground
		res.render("campgrounds/edit", {campground: foundCampground});
	});
});

// UPDATE route - update a campground
router.put("/campgrounds/:slug", middleware.checkCampgroundOwnership, upload.single("image"), function(req, res){
	cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
		if(err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		// add cloudinary url for the image to the campground object under image property
		req.body.image = result.secure_url;
		// add image's public_id to campground object
		req.body.imageId = result.public_id;
		// add author to campground
		req.body.author = {
			id: req.user._id,
			username: req.user.username
		}
		
		geocoder.geocode(req.body.location, function (err, data) {
			if (err || !data.length) {
				console.log(err);
				req.flash("error", "Invalid address!");
				return res.redirect("back");
			}

			req.body.lat = data[0].latitude;
			req.body.lng = data[0].longitude;
			req.body.location = data[0].formattedAddress;

			delete req.body.rating;

			Campground.findOne({slug: req.params.slug}, function (err, campground) {
				if (err) {
					console.log(err);
					res.redirect("/campgrounds");
				} else {
					campground.name = req.body.name;
					campground.price = req.body.price;
					campground.image = req.body.image;
					campground.description = req.body.description;
					campground.lat = req.body.lat;
					campground.lng = req.body.lng;
					campground.location = req.body.location;
					campground.save(function (err) {
						if (err) {
							console.log(err);
							req.flash("error", err.message);
							return res.redirect("back");
						} else {
							res.redirect("/campgrounds/" + campground.slug);
						}
					});
				}
			});
		});
	});
});

// DESTROY route - delete a campground along with all reviews and comments associated with it
router.delete("/campgrounds/:slug", middleware.checkCampgroundOwnership, function (req, res) {
	Campground.findOne({slug: req.params.slug}, function (err, campground) {
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

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;
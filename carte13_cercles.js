
<!---------------------------------------------------------------->
<!--------------------- Variables du script ---------------------->
<!---------------------------------------------------------------->

<!-- variables à adapter par l utilisateur -->
var path_json = "data/fond_pays.json"; // chemin du fond de carte JSON rapport au fichier html 
var path_csv = "data/donnees.csv"; // chemin des données CSV par rapport au fichier html
var colonne_code = "iso_a2"; // nom de la colonne contenant le code permettant de joindre le fond de carte JSON et les données CSV (ex. : "iso_a2" pour le code ISO 2) 
var annees = [2011, 2012, 2013];	// liste des années pour lesquelles il y a des données 
var racine_tot = "TOT_";	// nom de la colonne avec nb volontaires totaux, sans l'année ("TOT_" si la colonne s'appelle "TOT_2011" pour 2011, "TOT_2012" pour 2012 etc.) 
var racine_sci = "SCI_";	// nom de la colonne avec nb volontaires SCI, sans l'année ("TOT_" si la colonne s'appelle "TOT_2011" pour 2011, "TOT_2012" pour 2012 etc.)  
var racine_sve = "SVE_";	// nom de la colonne avec nb volontaires SVE, sans l'année ("TOT_" si la colonne s'appelle "TOT_2011" pour 2011, "TOT_2012" pour 2012 etc.) 
var racine_vp = "VP_";	// nom de la colonne avec nb volontaires VP, sans l'année ("TOT_" si la colonne s'appelle "TOT_2011" pour 2011, "TOT_2012" pour 2012 etc.) 
var racine_vsi = "VSI_";	// nom de la colonne avec nb volontaires VSI, sans l'année ("TOT_" si la colonne s'appelle "TOT_2011" pour 2011, "TOT_2012" pour 2012 etc.) 
var couleur_data = "#ccc";	// couleur des pays avec volontaires
var couleur_nodata = "#eee";	// couleur des pays sans volontaires
var evide = 100;	// nb de volontaires à partir duquel le cercle est évidé
var duree_transition = 1000;	// durée de la transition en millisecondes quand on change de données à afficher
var legende_cp = [12, 98, 250, 421]; // liste des valeurs à afficher dans la légende de la carte en cercles proportionnels


<!-- Width and height for the map -->
var wm = 960;
var hm = 500;
<!-- Width and height for the years -->
var wy = 100;
var hy = 500;
<!-- Width and height for the menu -->
var wme = 1300;
var hme = 100;
<!-- Width and height for the legend-->
var wl = 200;
var hl = 250;
<!-- padding pour que les ronds des années ne dépassent pas -->
var padding = 50;

<!-- élément svg pour les boutons -->
var svg_menu = d3.select("#menu")
			.append("svg")
			.style("fill", "pink")
			.attr("width", wme)
			.attr("height", hme);
			
<!-- élément svg pour les années -->
var svg_y = d3.select("#years")
			.append("svg")
			.attr("width", wy)
			.attr("height", hy);
			
<!-- élément svg pour la carte -->
var svg_map = d3.select("#map")
			.append("svg")
			.attr("width", wm)
			.attr("height", hm);
			
<!-- sous groupe pour les éléments de la carte (pays, cercles...) -->
var cartogroupe = svg_map.append("g");

<!-- sous groupe pour le planisphère (ces sous-groupes permettent que le planisphère soit toujours affiché en dernier, sinon à chaque mise à jour il repasse dessous) -->
var planigroupe = svg_map.append("g");

<!-- élément svg pour la légende -->
var svg_leg = d3.select("#type")
			.append("svg")
			.attr("width", wl)
			.attr("height", hl);
			
<!-- groupe pour la légende cp -->
var leg_cp_groupe = svg_leg.append("g")
			.attr("class", "leg_cp");
			
<!-- la projection dans laquelle afficher les données : Robinson -->
var projection = d3.geo.robinson()
		.scale(150);
<!-- On crée un nouvel objet path qui traduit le GeoJSON en SVG -->
var path = d3.geo.path()
	.projection(projection);
	
var graticule = d3.geo.graticule();

<!-- crée une échelle pour la représentation des années -->
var yScale = d3.scale.linear()
					<!-- input domain : entre min et max des années -->
					.domain([d3.max(annees, function(d) { return d; }), d3.min(annees, function(d) { return d; })])
					<!-- output range : entre 0 et hauteur de l élément, + padding -->
					.range([0 + 2*padding, hy - 2*padding]);


<!---------------------------------------------------------------->
<!-------------------------- Fonctions --------------------------->
<!---------------------------------------------------------------->


<!-- pour savoir quel type de dispositif de volontariat est sélectionné -->
var getdispo = function () {
	var dispo = document.getElementById("tous").checked;
	if (dispo == true) { return racine_tot; }
	var dispo = document.getElementById("sci").checked;
	if (dispo == true) { return racine_sci; }
	var dispo = document.getElementById("sve").checked;
	if (dispo == true) { return racine_sve; }
	var dispo = document.getElementById("vp").checked;
	if (dispo == true) { return racine_vp; }
	var dispo = document.getElementById("vsi").checked;
	if (dispo == true) { return racine_vsi; }
}


<!-- pour savoir quelle année est sélectionnée -->
var getyear = function () {
	var year = d3.select(".yearselect").text();
	return year;
}


<!-- calcul du rayon des cercles proportionnels en fonction des valeurs -->
var calc_rayon = function (d) {
	var rayon = 3 * Math.sqrt(d/Math.PI);
	return rayon;
}


<!-- pour lier les données CSV au json -->
var bind_csv_json = function (data, json, annee, dispo) {

	<!-- initializes all data to 0 in geojson -->
	for (var j = 0; j < json.features.length; j++) {
		json.features[j].properties[dispo + annee] = 0;
	}

	<!-- Merge the ag. data and GeoJSON --> 
	<!-- Loop through once for each ag. data value -->
	for (var i = 0; i < data.length; i++) {

		<!-- Grab state code --> 
		var dataState = data[i][colonne_code];
		
		<!-- Grab data value, and convert from string to float -->
		var dataValue = parseFloat(data[i][dispo + annee]);

		<!-- Find the corresponding state inside the GeoJSON -->
		for (var j = 0; j < json.features.length; j++) {
		
			var jsonState = json.features[j].properties[colonne_code];

			if (dataState == jsonState) {
		
				<!-- Copy the data value into the JSON -->
				json.features[j].properties[dispo + annee] = dataValue;
				
				<!-- Stop looking through the JSON -->
				break;
				
			}
		}
	}
}


<!-- Dessin des pays (utilisé pour dessiner la carte la 1ère fois) -->
var dessin_pays = function (json, annee, dispo) {
	<!-- joint les données (data) dans l ordre du code iso2, qui sert de clé -->
	var pays = cartogroupe.selectAll("path")
		.data(json.features, function(d) { return d.properties[colonne_code];});
	pays.enter()
		.append("path")
		.attr("d", path)
		<!-- si volontaires pour le pays, ce pays prend une couleur différente -->
		.style("fill", function(d) {
	   		<!-- Get data value -->
	   		var value = d.properties[dispo + annee];
	   		if (value) {
	   			<!-- If value exists… -->
		   		return couleur_data;
	   		}

	   });
}


<!-- Mise à jour des pays (avec transition) -->
var maj_pays = function (json, annee, dispo) {
	<!-- joint les données (data) dans l ordre du code iso2, qui sert de clé -->
	var pays  = cartogroupe.selectAll("path")
		.data(json.features, function(d) { return d.properties[colonne_code];});
	pays.transition()
		.duration(duree_transition)
	   	.attr("d", path)
	   	<!-- si volontaires pour le pays, ce pays prend une couleur différente -->
	   	.style("fill", function(d) {
	   		<!-- Get data value -->
	   		var value = d.properties[dispo + annee];
	   		if (value) {
	   			<!-- If value exists… -->
		   		return couleur_data;
	   		} else {
				return couleur_nodata;
			}

	   });
}


<!-- Dessin des cercles proportionnels (utilisé pour dessiner la carte la 1ère fois) -->
var dessin_cercles = function (json, annee, dispo) {
	<!-- joint les données (data) dans l ordre du code iso2, qui sert de clé (sinon problème car cercles triés ensuite par taille) -->
	var circle = cartogroupe.selectAll("circle")
		.data(json.features, function(d) { return d.properties[colonne_code];});
	<!-- la suite... -->
	circle.enter()
		.append("circle")
		.attr("cx", function(d){
				var centroid = path.centroid(d),
					x = centroid[0];
					return x;
		})
		.attr("cy", function(d){
				var centroid = path.centroid(d),
					y = centroid[1];
					return y;
		})
		<!-- calcule le rayon du cercle pour que la surface varie avec la valeur -->
		.attr("r", function(d){
				var nbvol = d.properties[dispo + annee];
				return calc_rayon(nbvol);
		})
		<!-- si la valeur est suffisamment importante, vide le cercle pour qu on ne voit que le contour -->
		.attr("class", function(d) {
			var value = d.properties[dispo + annee]; 
			if (value > evide) {
				return "gros";
			} 
		})
		/* trie les cercles en fonction du nb de vol pour mettre les + petits devant */
		.sort(function(a,b) {return b.properties[dispo + annee]*1-a.properties[dispo + annee]*1;});
}


<!-- Mise à jour des cercles proportionnels (avec transition) -->
var maj_cercles = function (json, annee, dispo) {
	<!-- joint les données (data) dans l ordre du code iso2, qui sert de clé (sinon problème car cercles triés ensuite par taille) -->
	var circle = cartogroupe.selectAll("circle")
		.data(json.features, function(d) { return d.properties[colonne_code]; });
	<!-- la suite... -->
	circle.transition()
		.duration(duree_transition)
		<!-- calcule le rayon du cercle pour que la surface varie avec la valeur -->
		.attr("r", function(d){
			var nbvol = d.properties[dispo + annee];
			return calc_rayon(nbvol);
		})
		<!-- si la valeur est suffisamment importante, vide le cercle pour qu on ne voit que le contour -->
		.attr("class", function(d) {
			var value = d.properties[dispo + annee]; 
			if (value > evide) {
			return "gros";
			} 
		})
		/* trie les cercles en fonction du nb de vol pour mettre les + petits devant */
		.sort(function(a,b) {return b.properties[dispo + annee]*1-a.properties[dispo + annee]*1;});
}


<!-- Affiche ou masque les éléments d une même classe -->
var show_hide_class = function(nom_classe, nom_display) { 
	var liste_elements = document.getElementsByClassName(nom_classe), j;
		for (var j = 0; j < liste_elements.length; j++) {
			liste_elements[j].style.display=nom_display;
		}
	}
	
<!-- Affiche les éléments d une classe, masque les éléments d une liste de classe -->
var show_hide_multiple = function (montre, cache) {
	for (var i =0; i < cache.length; i++) {
		show_hide_class(cache[i], "none");
	}
	for (var i =0; i < montre.length; i++) {
		show_hide_class(montre[i], "block");
	}
}


<!-- pour dessiner la carte la 1ère fois -->
var dessin_carte = function () {

	<!-- Chargement des données CSV -->
	d3.csv(path_csv, function (data) {
		<!-- Chargement des données JSON -->
		d3.json(path_json, function(json) {
			<!-- lie les données CSV pour l année et le dispositif en cours -->
			bind_csv_json(data, json, annee, dispo)
		
			<!-- affiche les pays, couleur en fonction année et dispositif en cours -->
			dessin_pays(json, annee, dispo)
		
			<!-- dessine les cercles, en fonction année et dispositif en cours -->
			dessin_cercles(json, annee, dispo)
		});
	});
}


<!-- pour mettre à jour la carte quand l utilisateur clique sur les boutons -->
var maj_carte = function (annee, dispo) {
	
	<!-- Chargement des données CSV -->
	d3.csv(path_csv, function (data) {
		<!-- Chargement des données JSON -->
		d3.json(path_json, function(json) {
			<!-- lie les données CSV pour l année et le dispositif en cours -->
			bind_csv_json(data, json, annee, dispo)
			
			<!-- met à jour les pays, couleur en fonction année et dispositif en cours -->
			maj_pays(json, annee, dispo);
	
			<!-- met à jour les cercles, en fonction année et dispositif en cours -->
			maj_cercles(json, annee, dispo);
			
		});
	})
}


<!---------------------------------------------------------------->
<!--------------- Le début du code proprement dit ---------------->
<!---------------------------------------------------------------->

<!-- initialise les 2 paramètres : année et type de dispositif -->
var annee = annees[0];
var dispo = racine_tot;

<!-- affiche le planisphère -->
var planisphere = planigroupe.append("path")
	.datum({type: "Sphere"})
	.attr("class", "plani")
	.attr("id", "sphere")
	.attr("d", path);

<!-- Pour afficher la carte initiale : première année, cercles proportionnels -->
dessin_carte(annee, dispo);

<!-- Ajout des cercles de la légende -->
leg_cp_groupe.selectAll("circle")
	.data(legende_cp)
	.enter()
	.append("circle")
	<!-- évide le cercle si sa valeur est supérieure à celle définie par l utilisateur -->
	.attr("class", function(d) {
				if (d > evide) {
					return "gros";
				} 
			})
	.attr("cx", 40)
	.attr("cy", function (d) { return 100 - calc_rayon(d); })
	.attr("r", function(d) { return calc_rayon(d); });

<!-- Ajout des lignes de la légende -->
leg_cp_groupe.selectAll("line")
	.data(legende_cp)
	.enter()
	.append("line")
	.attr("class", "legende")
	.attr("x1", 40)
	.attr("y1", function (d) { return 100 - 2*calc_rayon(d); })
	.attr("x2", 90)
	.attr("y2", function (d) { return 100 - 2*calc_rayon(d); });
				
<!-- affiche les étiquettes de la légende -->
leg_cp_groupe.selectAll("text")
   .data(legende_cp)
   .enter()
   .append("text")
   .attr("class", "legende")
   .text(function(d) { return (d); })
   .attr("x", 95)
   .attr("y", function (d) { return 100 - 2*calc_rayon(d); });

<!-- affiche une ligne (rectangle) pour les années -->
var ligne = svg_y.append("rect")
	.attr("x", 30)
	.attr("y", 4)
	.attr("width", 4)
	.attr("height", 650)
	.attr("fill", "darkgray")
<!-- affiche un triangle tout en haut de la ligne pour en faire une flèche -->
svg_y.append('path')
	.attr("class", "triangle")
	.attr('d', function(d) { 
		var x = 32, y = 4;
		return 'M ' + x +' '+ y + ' l 5 10 l -10 0 z';
	 });
	 
<!-- affiche les étiquettes des années -->
svg_y.selectAll("text")
	.data(annees)
	.enter()
	.append("text")
	.text(function(d) { return (d); })
	.attr("x", 47)
	.attr("y", function(d) { return yScale(d) ; })
	.attr("font-weight", "bold")
	.attr("fill", "grey");

<!-- affiche les années sous forme de ronds -->
svg_y.selectAll("circle")
	.data(annees)
	.enter()
	.append("circle")
	.attr("class", function(d){
				if (d <= annees[0]) {
					return "yearselect";
				} else {
					return "year";
				}
			})
	.attr("cx", 32)
	.attr("cy", function(d) { return yScale(d); })
	.attr("r", 8)
	.text(function(d) { return (d); }) // attribue comme texte l année, pour facilement la récupérer avec la fonction getyear()
   
  	<!-- si on clique sur une année, actualise les données en fonction de l année -->
   .on("click", function() {
   
   		<!-- réinitialise le style de tous les cercles années -->
	   	svg_y.selectAll("circle")
	   		.attr("class", "year");
	   		
	   	<!-- change le style du cercle année cliqué -->
	   	d3.select(this)
	   		.attr("class", "yearselect");
			
		<!-- récupère les paramètres -->
		annee = getyear();
		dispo = getdispo();
		
   		<!-- redessine la carte -->
   		maj_carte(annee, dispo);
		
	});

<!-- quand on clique sur les boutons tous, sci, sve... -->
d3.selectAll(".rd")
	.on("click", function() {
	
		<!-- récupère les paramètres -->
		annee = getyear();
		dispo = getdispo();
		
		<!-- redessine la carte -->
   		maj_carte(annee, dispo);
   		
   		<!-- met à jour la description du dispositif -->
   		show_hide_multiple(["dispo_" + dispo.toLowerCase().substr(0, dispo.length - 1)], ["dispo_tous", "dispo_sci", "dispo_sve", "dispo_vp", "dispo_vsi"]);
   		
	});
	
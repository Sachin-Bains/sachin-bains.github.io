% Original Parameters
R_exit = 600; % Exit radius in mm
R_inlet = R_exit / 3;
R_throat = 0.0833 * R_exit;
L_nozzle = 2.5 * R_exit;
throat_length = 0.167 * R_exit;
divergent_length = 2.5 * R_exit - throat_length;
% Scaling factor
scale_factor = 0.25;
% Scaled Parameters
R_exit_scaled = R_exit * scale_factor;
R_inlet_scaled = R_inlet * scale_factor;
R_throat_scaled = R_throat * scale_factor;
L_nozzle_scaled = L_nozzle * scale_factor;
throat_length_scaled = throat_length * scale_factor;
divergent_length_scaled = divergent_length * scale_factor;
% Number of points
N = 500;
% Define the throat section (assume linear for simplicity)
x_throat = linspace(0, throat_length_scaled, N);
y_throat = linspace(R_inlet_scaled, R_throat_scaled, N);
% Define the divergent section (assume parabolic for simplicity)
x_divergent = linspace(throat_length_scaled, L_nozzle_scaled, N);
y_divergent = R_throat_scaled + (R_exit_scaled - R_throat_scaled) * ((x_divergent - throat_length_scaled) / divergent_length_scaled).^2;
% Combine sections
x = [x_throat, x_divergent];
y = [y_throat, y_divergent];
% Plot the nozzle contour
figure;
plot(x, y, 'b', 'LineWidth', 2);
hold on;
plot(x, -y, 'b', 'LineWidth', 2); % Mirror image for the bottom part
xlabel('x-ordinate (mm)');
ylabel('Radial ordinate (mm)');
title('Scaled Nozzle Contour (0.25x)');
axis equal;
grid on;
set(gca, 'FontSize', 12); % Increase font size for better readability
disp('0.25x Scale Nozzle Contour based on Rocket Plume Interacting with Mars Soil Particulates.');
% Calculations for flow properties
% Parameters
gamma = 1.4; % Specific heat ratio
P0 = 200 * 101325; % Total stagnation pressure in Pascals (200 times Earth's atmospheric pressure)
T0 = 3300; % Total stagnation temperature in Kelvin
P_ambient = 699; % Mars ambient pressure in Pascals
T_ambient = 210; % Mars ambient temperature in Kelvin
% Calculate area ratio (A_exit / A_throat)
A_throat = pi * (R_throat_scaled / 1000)^2; % Throat area in m^2
A_exit = pi * (R_exit_scaled / 1000)^2; % Exit area in m^2
A_ratio = A_exit / A_throat; % Expansion ratio
% Function to calculate the area ratio for a given Mach number
area_ratio_func = @(M) (1 / M) * ((2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * M^2))^((gamma + 1) / (2 * (gamma - 1))) - A_ratio;
% Solve for the exit Mach number
exit_Mach = fzero(area_ratio_func, [1 10]);
% Calculate static pressure at the inlet (isentropic relations)
% P0/P = (1 + ((gamma - 1)/2) * M^2)^(gamma/(gamma - 1))
P_inlet_static = P0 / ((1 + ((gamma - 1) / 2) * exit_Mach^2)^(gamma / (gamma - 1)));
% Display the results
disp(['Exit Mach number: ', num2str(exit_Mach)]);
disp(['Area ratio (expansion ratio): ', num2str(A_ratio)]);
disp(['Supersonic static inlet pressure: ', num2str(P_inlet_static), ' Pa']);